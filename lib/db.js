const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não definida no .env');
  throw new Error('Defina a variável MONGODB_URI no .env');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log('📡 Conectando ao MongoDB Atlas...');
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
      console.log(`📊 Banco de dados: ${mongoose.connection.name}`);
      console.log(`📍 Host: ${mongoose.connection.host}`);
      return mongoose;
    }).catch((err) => {
      console.error('❌ Erro ao conectar ao MongoDB:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('❌ Erro ao conectar ao MongoDB:', e.message);
    throw e;
  }

  return cached.conn;
}

module.exports = connectDB;
