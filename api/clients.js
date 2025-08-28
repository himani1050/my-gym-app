// api/clients.js
const mongoose = require('mongoose');

// --- Enhanced Connection caching for Vercel serverless environment ---
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// ✅ Enhanced database connection with better error handling and pooling
async function dbConnect() {
  console.log(`${new Date().toISOString()} - Database connection attempt`);

  if (cached.conn && cached.conn.readyState === 1) {
    console.log('Using existing database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    // ✅ FIXED: Less aggressive connection options for Vercel
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,        // ✅ Increased from 2 to 10
      minPoolSize: 1,         // ✅ Maintain minimum connections
      maxIdleTimeMS: 30000,   // ✅ Keep existing
      serverSelectionTimeoutMS: 15000, // ✅ Increased from 10 to 15 seconds
      socketTimeoutMS: 45000, // ✅ Keep existing
      connectTimeoutMS: 15000, // ✅ Increased from 10 to 15 seconds
      heartbeatFrequencyMS: 10000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    };

    console.log('Creating new database connection...');
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts)
      .then(mongoose => {
        console.log('✅ MongoDB connected successfully');
        return mongoose;
      })
      .catch(error => {
        console.error('❌ MongoDB connection failed:', error.message);
        cached.conn = null;
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('Database connection error:', error);
    cached.conn = null;
    cached.promise = null;
    throw error;
  }
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
  aadhaar: {
    type: String,
    required: [true, 'Aadhaar number is required'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{12}$/.test(v);
      },
      message: 'Aadhaar number must be exactly 12 digits'
    }
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
  medicalCondition: {
    hasMedicalCondition: {
      type: Boolean,
      default: false
    },
    conditionDetails: {
      type: String,
      trim: true,
      default: ''
    }
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

// ✅ Enhanced error handling wrapper
const handleDatabaseOperation = async (operation, operationType) => {
  const startTime = Date.now();
  try {
    console.log(`${new Date().toISOString()} - Starting ${operationType} operation`);
    const result = await operation();
    const duration = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${operationType} completed successfully in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`${new Date().toISOString()} - ${operationType} failed after ${duration}ms:`, error.message);
    throw error;
  }
};

// --- Enhanced Handler ---
module.exports = async (req, res) => {
  // ✅ Add CORS headers for better browser compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`${new Date().toISOString()} - ${req.method} request received`);

  try {
    await dbConnect();
  } catch (error) {
    console.error('Database connection failed:', error);
    return res.status(503).json({
      message: 'Database connection failed. Please try again later.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  switch (req.method) {
    case 'GET':
      try {
        const clients = await handleDatabaseOperation(
          () => Client.find({}).lean().exec(), // ✅ Added .lean() for better performance
          'GET_CLIENTS'
        );
        res.status(200).json(clients);
      } catch (error) {
        console.error('GET operation error:', error);
        res.status(500).json({
          message: 'Error fetching clients.',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      break;

    case 'POST':
      try {
        const {
          name, contact, aadhaar, heightFt, heightIn, weight,
          goal, feesSubmitted, feesDue, pt, months, feeDate,
          hasMedicalCondition, medicalConditionDetails
        } = req.body;

        // ✅ Enhanced validation
        if (!name || !contact || !aadhaar) {
          return res.status(400).json({
            message: 'Missing required fields: name, contact, or aadhaar',
            timestamp: new Date().toISOString()
          });
        }

        const client = await handleDatabaseOperation(
          async () => {
            const newClient = new Client({
              name,
              contact,
              aadhaar,
              height: { ft: heightFt, in: heightIn },
              weight,
              goal,
              medicalCondition: {
                hasMedicalCondition: hasMedicalCondition || false,
                conditionDetails: hasMedicalCondition ? (medicalConditionDetails || '') : ''
              },
              fees: { submitted: feesSubmitted, due: feesDue },
              pt,
              membership: {
                months,
                feeDate: new Date(feeDate),
                endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
              }
            });
            return await newClient.save();
          },
          'CREATE_CLIENT'
        );

        res.status(201).json(client);
      } catch (error) {
        console.error('POST operation error:', error);

        if (error.code === 11000) {
          // ✅ Better duplicate key error handling
          const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
          res.status(409).json({
            message: `A client with this ${duplicateField} already exists.`,
            field: duplicateField,
            timestamp: new Date().toISOString()
          });
        } else if (error.name === 'ValidationError') {
          res.status(400).json({
            message: 'Validation failed',
            errors: Object.keys(error.errors).map(key => ({
              field: key,
              message: error.errors[key].message
            })),
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            message: 'Error creating client.',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      break;

    case 'PUT':
      try {
        const clientId = req.query.id || req.body.id;
        const {
          name, contact, aadhaar, heightFt, heightIn, weight,
          goal, feesSubmitted, feesDue, pt, months, feeDate,
          hasMedicalCondition, medicalConditionDetails
        } = req.body;

        if (!clientId) {
          return res.status(400).json({
            message: 'Client ID is required for update.',
            timestamp: new Date().toISOString()
          });
        }

        // ✅ Check if client exists first
        const existingClient = await Client.findById(clientId).lean();
        if (!existingClient) {
          return res.status(404).json({
            message: 'Client not found.',
            timestamp: new Date().toISOString()
          });
        }

        const updatedClient = await handleDatabaseOperation(
          async () => {
            const updateData = {
              name,
              contact,
              aadhaar,
              height: { ft: heightFt, in: heightIn },
              weight,
              goal,
              medicalCondition: {
                hasMedicalCondition: hasMedicalCondition || false,
                conditionDetails: hasMedicalCondition ? (medicalConditionDetails || '') : ''
              },
              fees: { submitted: feesSubmitted, due: feesDue },
              pt,
              membership: {
                months,
                feeDate: new Date(feeDate),
                endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
              }
            };

            return await Client.findByIdAndUpdate(
              clientId,
              updateData,
              { new: true, runValidators: true }
            );
          },
          'UPDATE_CLIENT'
        );

        res.status(200).json(updatedClient);
      } catch (error) {
        console.error('PUT operation error:', error);

        if (error.code === 11000) {
          const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
          res.status(409).json({
            message: `Another client with this ${duplicateField} already exists.`,
            field: duplicateField,
            timestamp: new Date().toISOString()
          });
        } else if (error.name === 'ValidationError') {
          res.status(400).json({
            message: 'Validation failed',
            errors: Object.keys(error.errors).map(key => ({
              field: key,
              message: error.errors[key].message
            })),
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            message: 'Error updating client.',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      break;

    case 'DELETE':
      try {
        const { id } = req.body;

        if (!id) {
          return res.status(400).json({
            message: 'Client ID is required for deletion.',
            timestamp: new Date().toISOString()
          });
        }

        const deletedClient = await handleDatabaseOperation(
          () => Client.findByIdAndDelete(id),
          'DELETE_CLIENT'
        );

        if (!deletedClient) {
          return res.status(404).json({
            message: 'Client not found.',
            timestamp: new Date().toISOString()
          });
        }

        res.status(200).json({
          message: 'Client deleted successfully.',
          deletedClient: {
            id: deletedClient._id,
            name: deletedClient.name
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('DELETE operation error:', error);
        res.status(500).json({
          message: 'Error deleting client.',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      break;

    default:
      res.status(405).json({
        message: 'Method Not Allowed',
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        timestamp: new Date().toISOString()
      });
      break;
  }
};
