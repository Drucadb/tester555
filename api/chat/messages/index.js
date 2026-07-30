const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const ChatMessage = require('../../../models/ChatMessage');
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
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ message: auth.error });
  }

  try {
    await connectDB();

    const user = auth.user;
    const isAdmin = user.role === 'admin';

    // ===== GET - Buscar mensagens =====
    if (req.method === 'GET') {
      const { room = 'support', limit = 50 } = req.query;

      const query = { room };
      
      // Se não for admin, vê mensagens do usuário + respostas de admin
      if (!isAdmin) {
        query.$or = [
          { sender: user._id },
          { receiver: user._id },
          { receiver: null, sender: { $ne: user._id } } // Mensagens públicas
        ];
      }

      const messages = await ChatMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('sender', 'username email role')
        .populate('receiver', 'username email role');

      return res.status(200).json({
        messages: messages.reverse(),
        total: await ChatMessage.countDocuments(query)
      });
    }

    // ===== POST - Enviar mensagem =====
    if (req.method === 'POST') {
      const { message, receiverId, room = 'support' } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ 
          message: 'Mensagem é obrigatória' 
        });
      }

      if (message.length > 500) {
        return res.status(400).json({ 
          message: 'Mensagem muito longa (máx 500 caracteres)' 
        });
      }

      // Se for admin e tiver receiverId, envia mensagem privada
      let receiver = null;
      if (receiverId && isAdmin) {
        receiver = await User.findById(receiverId);
        if (!receiver) {
          return res.status(404).json({ 
            message: 'Usuário não encontrado' 
          });
        }
      }

      // Se for admin e não tiver receiverId, mensagem pública
      const chatMessage = await ChatMessage.create({
        sender: user._id,
        receiver: receiverId || null,
        message: message.trim(),
        type: isAdmin ? 'admin' : 'user',
        room,
        read: false
      });

      // --- NOTIFICAR O RECEPTOR (SE FOR ADMIN RESPONDENDO) ---
      if (isAdmin && receiverId) {
        // O usuário que mandou a mensagem original vai receber a resposta
        // O receptor é o usuário que o admin está respondendo
        // A notificação vai para o usuário que enviou a mensagem original
        try {
          await fetch(`${process.env.NEXTAUTH_URL || 'https://tester555.vercel.app'}/api/chat/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: receiverId,
              username: user.username,
              message: message.trim(),
              chatId: chatMessage._id,
              isAdmin: true
            })
          });
        } catch (e) {
          console.log('Notificação não enviada:', e.message);
        }
      }

      // --- NOTIFICAR ADMIN (SE FOR USUÁRIO NORMAL) ---
      if (!isAdmin) {
        try {
          // Buscar todos os admins para notificar
          const admins = await User.find({ role: 'admin' }).select('_id');
          
          for (const admin of admins) {
            await fetch(`${process.env.NEXTAUTH_URL || 'https://tester555.vercel.app'}/api/chat/notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: admin._id,
                username: user.username,
                message: message.trim(),
                chatId: chatMessage._id,
                isAdmin: false,
                fromUser: user._id
              })
            });
          }
        } catch (e) {
          console.log('Notificação não enviada:', e.message);
        }
      }

      // Buscar a mensagem completa para retornar
      const fullMessage = await ChatMessage.findById(chatMessage._id)
        .populate('sender', 'username email role')
        .populate('receiver', 'username email role');

      return res.status(201).json({
        message: 'Mensagem enviada! ✨',
        chatMessage: fullMessage
      });
    }

    // ===== PUT - Marcar como lida =====
    if (req.method === 'PUT') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ 
          message: 'ID da mensagem é obrigatório' 
        });
      }

      const chatMessage = await ChatMessage.findById(id);
      
      if (!chatMessage) {
        return res.status(404).json({ 
          message: 'Mensagem não encontrada' 
        });
      }

      // Admin pode marcar qualquer mensagem como lida
      // Usuário só pode marcar as próprias mensagens
      if (!isAdmin && chatMessage.sender.toString() !== user._id.toString()) {
        return res.status(403).json({ 
          message: 'Acesso negado' 
        });
      }

      chatMessage.read = true;
      chatMessage.readAt = new Date();
      await chatMessage.save();

      return res.status(200).json({
        message: 'Mensagem marcada como lida',
        read: true
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });

  } catch (error) {
    console.error('❌ Erro no chat:', error);
    return res.status(500).json({ 
      message: 'Erro ao processar mensagem' 
    });
  }
};