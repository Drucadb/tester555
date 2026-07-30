const connectDB = require('../../lib/db');
const User = require('../../models/User');
const Invite = require('../../models/Invite');
const jwt = require('jsonwebtoken');

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token não fornecido', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    await connectDB();
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return { error: 'Usuário não encontrado', status: 404 };
    }
    
    return { user };
  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
}

module.exports = async (req, res) => {
  // CORS para Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ message: auth.error });
  }

  try {
    await connectDB();

    const user = auth.user;

    // Buscar convites do usuário
    const invites = await Invite.find({ 
      creator: user._id 
    }).sort({ createdAt: -1 });

    // Estatísticas
    const stats = {
      total: invites.length,
      active: invites.filter(i => i.isActive).length,
      totalUses: invites.reduce((acc, i) => acc + i.uses, 0)
    };

    return res.status(200).json({
      invites,
      stats
    });

  } catch (error) {
    console.error('❌ Erro ao listar convites:', error);
    return res.status(500).json({ 
      message: 'Erro ao listar convites' 
    });
  }
};
