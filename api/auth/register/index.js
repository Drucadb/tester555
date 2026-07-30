const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Todos os campos são obrigatórios' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Email inválido' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Senha deve ter pelo menos 6 caracteres' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Usuário ou email já cadastrado' 
      });
    }

    // ===== REGRA: Admin se for o primeiro OU se chamar "admin" =====
    const userCount = await User.countDocuments();
    const isAdmin = userCount === 0 || username.toLowerCase() === 'admin';
    
    const role = isAdmin ? 'admin' : 'user';
    
    let adminMessage = '';
    if (isAdmin) {
      if (username.toLowerCase() === 'admin') {
        adminMessage = '👑 Você se registrou como ADMINISTRADOR!';
      } else if (userCount === 0) {
        adminMessage = '👑 Primeiro usuário do sistema! Você é ADMINISTRADOR!';
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    const userWithoutPassword = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message: adminMessage || 'Usuário criado com sucesso! ✨',
      user: userWithoutPassword,
      isAdmin: role === 'admin',
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar usuário' 
    });
  }
};
