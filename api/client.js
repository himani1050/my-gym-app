// api/clients.js

const mongoose = require('mongoose');

// --- Connection caching for Vercel serverless environment ---
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).then(mongoose => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// --- Mongoose Schema and Model ---
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contact: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^\d{10}$/
  },
  height: {
    ft: Number,
    in: Number,
  },
  weight: Number,
  goal: {
    type: String,
    enum: [
      'Gain Weight',
      'Lose Weight',
      'Maintain Weight',
      'Powerlifting',
      'Bodybuilding'
    ],
    required: true
  },
  fees: {
    submitted: { type: Number, required: true },
    due: { type: Number, default: 0 }
  },
  pt: {
    type: String,
    enum: ['None', 'Standard', 'Advanced'],
    default: 'None'
  },
  membership: {
    months: { type: Number, required: true },
    feeDate: { type: Date, required: true },
    endDate: Date
  }
}, { timestamps: true });

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

// --- Handler ---
module.exports = async (req, res) => {
  await dbConnect();
  switch (req.method) {
    case 'GET':
      // Get All Clients
      try {
        const clients = await Client.find({});
        res.status(200).json(clients);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching clients.', error: error.message });
      }
      break;

    case 'POST':
      // Create a new Client
      try {
        const {
          name,
          contact,
          heightFt,
          heightIn,
          weight,
          goal,
          feesSubmitted,
          feesDue,
          pt,
          months,
          feeDate
        } = req.body;

        const newClient = new Client({
          name,
          contact,
          height: { ft: heightFt, in: heightIn },
          weight,
          goal,
          fees: { submitted: feesSubmitted, due: feesDue },
          pt,
          membership: {
            months,
            feeDate: new Date(feeDate),
            endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
          }
        });

        const client = await newClient.save();
        res.status(201).json(client);
      } catch (error) {
        if (error.code === 11000) {
          res.status(409).json({ message: 'A client with this contact number already exists.' });
        } else {
          res.status(500).json({ message: 'Error creating client.', error: error.message });
        }
      }
      break;

    case 'PUT':
      // Update an Existing Client
      try {
        const {
          id,
          name,
          contact,
          heightFt,
          heightIn,
          weight,
          goal,
          feesSubmitted,
          feesDue,
          pt,
          months,
          feeDate
        } = req.body;

        const updateData = {
          name,
          contact,
          height: { ft: heightFt, in: heightIn },
          weight,
          goal,
          fees: { submitted: feesSubmitted, due: feesDue },
          pt,
          membership: {
            months,
            feeDate: new Date(feeDate),
            endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
          }
        };

        const updatedClient = await Client.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!updatedClient) {
          return res.status(404).json({ message: 'Client not found.' });
        }
        res.status(200).json(updatedClient);
      } catch (error) {
        if (error.code === 11000) {
          res.status(409).json({ message: 'A client with this contact number already exists.' });
        } else {
          res.status(500).json({ message: 'Error updating client.', error: error.message });
        }
      }
      break;

    case 'DELETE':
      // Delete a Client by ID (expects id in body)
      try {
        const { id } = req.body;
        const deletedClient = await Client.findByIdAndDelete(id);
        if (!deletedClient) {
          return res.status(404).json({ message: 'Client not found.' });
        }
        res.status(200).json({ message: 'Client deleted successfully.' });
      } catch (error) {
        res.status(500).json({ message: 'Error deleting client.', error: error.message });
      }
      break;

    default:
      res.status(405).json({ message: 'Method Not Allowed' });
      break;
  }
};
