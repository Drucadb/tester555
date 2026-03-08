export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cookie } = req.body;

  if (!cookie) {
    return res.status(400).json({ 
      valido: false, 
      erro: 'Cookie não fornecido' 
    });
  }

  try {
    // Limpar cookie
    let cookieLimpo = cookie.trim().replace(/^["']|["']$/g, '');
    
    if (!cookieLimpo.startsWith('_|WARNING')) {
      cookieLimpo = `_|WARNING:-DO-NOT-SHARE-THIS.--${cookieLimpo}`;
    }

    // Validar com Roblox
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookieLimpo}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(401).json({
        valido: false,
        erro: 'Cookie inválido ou expirado',
        cookieExpirado: true
      });
    }

    const data = await response.json();
    
    // Verificar idade da conta
    let contaRecente = false;
    try {
      const userResponse = await fetch(`https://users.roblox.com/v1/users/${data.id}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.created) {
          const dias = Math.floor((Date.now() - new Date(userData.created)) / (1000 * 60 * 60 * 24));
          contaRecente = dias < 30;
        }
      }
    } catch (e) {}

    return res.status(200).json({
      valido: true,
      username: data.name,
      userId: data.id,
      contaRecente: contaRecente
    });

  } catch (error) {
    return res.status(500).json({
      valido: false,
      erro: 'Erro ao verificar cookie'
    });
  }
}