// api/utils/validadores.js

function validarFormatoCookie(cookie) {
    let c = cookie.trim().replace(/^["']|["']$/g, '');
    
    // Verificar se começa com o formato correto
    if (!c.startsWith('_|WARNING') && !c.startsWith('WARNING')) {
        return { 
            valido: false, 
            motivo: 'Formato inválido - Deve começar com _|WARNING' 
        };
    }
    
    // Verificar se contém o aviso de segurança
    if (!c.includes('DO-NOT-SHARE')) {
        return { 
            valido: false, 
            motivo: 'Formato inválido - Deve conter DO-NOT-SHARE' 
        };
    }
    
    // Verificar tamanho mínimo
    if (c.length < 50) {
        return { 
            valido: false, 
            motivo: 'Cookie muito curto' 
        };
    }
    
    if (c.length > 1000) {
        return { 
            valido: false, 
            motivo: 'Cookie muito longo' 
        };
    }
    
    // Extrair token
    const partes = c.split('--');
    const tokenPart = partes[partes.length - 1]?.trim();
    const regexToken = /^[A-Za-z0-9_\-]+$/;
    
    if (!tokenPart || !regexToken.test(tokenPart)) {
        return { 
            valido: false, 
            motivo: 'Token inválido' 
        };
    }
    
    return { 
        valido: true, 
        cookieLimpo: c,
        token: tokenPart
    };
}

function detectarBot(userAgent) {
    const bots = [
        'bot', 'crawler', 'spider', 'scraper',
        'python', 'curl', 'wget', 'java',
        'php', 'ruby', 'perl', 'go-http',
        'headless', 'selenium', 'puppeteer'
    ];
    
    const ua = userAgent.toLowerCase();
    return bots.some(bot => ua.includes(bot));
}

function calcularIdade(dataCriacao) {
    const criacao = new Date(dataCriacao);
    const agora = new Date();
    const diffMs = agora - criacao;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDias < 30) {
        return {
            dias: diffDias,
            ehRecente: true,
            texto: `${diffDias} dias`
        };
    }
    
    const diffMeses = Math.floor(diffDias / 30);
    if (diffMeses < 12) {
        return {
            dias: diffDias,
            meses: diffMeses,
            ehRecente: false,
            texto: `${diffMeses} meses`
        };
    }
    
    const diffAnos = Math.floor(diffMeses / 12);
    return {
        dias: diffDias,
        anos: diffAnos,
        ehRecente: false,
        texto: `${diffAnos} anos`
    };
}

module.exports = {
    validarFormatoCookie,
    detectarBot,
    calcularIdade
};