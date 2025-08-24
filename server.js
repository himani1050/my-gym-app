// server.js

// -----------------------------------------------------------------------------
// BACKEND SERVER SETUP & API ENDPOINTS
// This is a complete Node.js/Express server with MongoDB integration.
// It uses Mongoose for schema-based data modeling and provides a RESTful API
// for creating, reading, updating, and deleting client data.
// -----------------------------------------------------------------------------

// 1. Import required packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from a .env file

// 2. Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// 3. Middleware setup
// Enable CORS for all routes, allowing the frontend to make requests
const corsOptions = {
  // Replace with your actual Vercel frontend URL
  origin: 'https://my-gym-app.vercel.app',
  optionsSuccessStatus: 200 // For legacy browser support
}
app.use(cors(corsOptions));
// Parse incoming JSON requests, making it available on req.body
app.use(express.json());

// 4. Connect to MongoDB using Mongoose
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is not defined in the .env file!");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected successfully.'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


// 5. Define the Mongoose Schema for a Client
// This schema maps directly to the data fields from your HTML form.
const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    unique: true, // Prevents duplicate contact numbers
    trim: true,
    match: /^\d{10}$/ // Simple validation for a 10-digit number
  },
  height: {
    ft: Number,
    in: Number
  },
  weight: Number,
  goal: {
    type: String,
    enum: ['Gain Weight', 'Lose Weight', 'Maintain Weight', 'Powerlifting', 'Bodybuilding'],
    required: true
  },
  fees: {
    submitted: {
      type: Number,
      required: true
    },
    due: {
      type: Number,
      default: 0
    }
  },
  pt: {
    type: String,
    enum: ['None', 'Standard', 'Advanced'],
    default: 'None'
  },
  membership: {
    months: {
      type: Number,
      required: true
    },
    feeDate: {
      type: Date,
      required: true
    },
    // The expiration date can be calculated in the frontend, but storing it here can be useful for queries.
    // For simplicity, we can also calculate it when a client is saved.
    endDate: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Create a Mongoose Model from the schema
const Client = mongoose.model('Client', clientSchema);


// 6. Define API routes (CRUD operations)
const router = express.Router();

// ------------------------------------
// CREATE a new client (POST)
// ------------------------------------
router.post('/', async (req, res) => {
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

    // Create a new client instance
    const newClient = new Client({
      name,
      contact,
      height: {
        ft: heightFt,
        in: heightIn
      },
      weight,
      goal,
      fees: {
        submitted: feesSubmitted,
        due: feesDue
      },
      pt,
      membership: {
        months,
        feeDate: new Date(feeDate),
        // Calculate the membership end date
        endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
      }
    });

    const client = await newClient.save();
    res.status(201).json(client); // Send the created client back with a 201 status
  } catch (error) {
    if (error.code === 11000) {
      // 11000 is the error code for duplicate key (e.g., contact number)
      res.status(409).json({
        message: 'A client with this contact number already exists.'
      });
    } else {
      res.status(500).json({
        message: 'Error creating client.',
        error: error.message
      });
    }
  }
});

// ------------------------------------
// READ all clients (GET)
// ------------------------------------
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find({}); // Find all clients
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching clients.',
      error: error.message
    });
  }
});

// ------------------------------------
// READ a single client (GET by ID)
// ------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        message: 'Client not found.'
      });
    }
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching client.',
      error: error.message
    });
  }
});

// ------------------------------------
// UPDATE a client (PUT)
// ------------------------------------
router.put('/:id', async (req, res) => {
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

    // Prepare the update object
    const updateData = {
      name,
      contact,
      height: {
        ft: heightFt,
        in: heightIn
      },
      weight,
      goal,
      fees: {
        submitted: feesSubmitted,
        due: feesDue
      },
      pt,
      membership: {
        months,
        feeDate: new Date(feeDate),
        endDate: new Date(new Date(feeDate).setMonth(new Date(feeDate).getMonth() + months))
      }
    };

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      updateData, {
        new: true,
        runValidators: true
      } // `new: true` returns the updated document
    );

    if (!updatedClient) {
      return res.status(404).json({
        message: 'Client not found.'
      });
    }

    res.status(200).json(updatedClient);
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({
        message: 'A client with this contact number already exists.'
      });
    } else {
      res.status(500).json({
        message: 'Error updating client.',
        error: error.message
      });
    }
  }
});

// ------------------------------------
// DELETE a client (DELETE)
// ------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const deletedClient = await Client.findByIdAndDelete(req.params.id);

    if (!deletedClient) {
      return res.status(404).json({
        message: 'Client not found.'
      });
    }

    res.status(200).json({
      message: 'Client deleted successfully.'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting client.',
      error: error.message
    });
  }
});

// Use the router for all API endpoints under the '/api/clients' path
app.use('/api/clients', router);

// Add a catch-all route for the root
app.get('/', (req, res) => {
    res.send('MBFC Gym Client Manager API is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
