const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { username, email, password } = req.body;

    // Validar campos
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Todos os campos são obrigatórios' 
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Email inválido' 
      });
    }

    // Validar senha
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Senha deve ter pelo menos 6 caracteres' 
      });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Usuário ou email já cadastrado' 
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Remover senha do retorno
    const userWithoutPassword = {
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message: 'Usuário criado com sucesso! ✨',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar usuário' 
    });
  }
};