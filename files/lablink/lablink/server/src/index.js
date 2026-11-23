import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes.js';
import seed from './seed.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);
app.use((e, req, res, next) => res.status(e.status || 500).json({ message: e.message || 'Server error' }));

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lablink');
await seed();
app.listen(process.env.PORT || 5000, () => console.log('LabLink API running on port ' + (process.env.PORT || 5000)));
