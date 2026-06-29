// /api/detect/index.js

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }

    // ===== PEGAR IP DO VISITANTE =====
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'IP não identificado';
    
    const ipFinal = ip.split(',')[0].trim();

    // ===== DETECTAR NAVEGADOR ANÔNIMO VIA HEADERS =====
    const isPrivate = detectPrivateBrowsing(req);

    // ===== DETECTAR VPN/PROXY (MÚLTIPLOS MÉTODOS) =====
    const vpnInfo = await detectVPNMultiMethod(ipFinal, req);

    // ===== RESULTADO FINAL =====
    const blocked = isPrivate || vpnInfo.isVPN;

    res.status(200).json({
        success: true,
        data: {
            ip: ipFinal,
            isPrivate: isPrivate,
            vpn: vpnInfo,
            blocked: blocked,
            message: blocked ? '🚫 Acesso bloqueado!' : '✅ Acesso permitido!',
            timestamp: new Date().toISOString()
        }
    });
}

// ===== FUNÇÃO PARA DETECTAR NAVEGADOR ANÔNIMO (MELHORADA) =====
function detectPrivateBrowsing(req) {
    const headers = req.headers;
    const userAgent = headers['user-agent'] || '';
    
    // 1. Verificar headers específicos (alguns navegadores enviam)
    if (headers['sec-ch-ua'] && headers['sec-ch-ua'].includes('Not_A Brand')) {
        return true;
    }
    
    // 2. Verificar se é um bot/headless browser
    if (userAgent.includes('Headless') || 
        userAgent.includes('PhantomJS') || 
        userAgent.includes('Puppeteer')) {
        return true;
    }
    
    // 3. Verificar DNT (Do Not Track) - alguns navegadores anônimos ativam
    if (headers['dnt'] === '1' && !headers['sec-ch-ua-mobile']) {
        // Pode ser anônimo, mas não é conclusivo
        return false; // Não bloquear só por isso
    }
    
    return false;
}

// ===== FUNÇÃO PARA DETECTAR VPN COM MÚLTIPLOS MÉTODOS =====
async function detectVPNMultiMethod(ip, req) {
    const results = {
        isVPN: false,
        details: {
            country: 'Desconhecido',
            region: 'Desconhecido',
            city: 'Desconhecido',
            isp: 'Desconhecido',
            org: 'Desconhecido',
            isProxy: false,
            isDatacenter: false,
            methods: []
        }
    };

    // ===== MÉTODO 1: ip-api.com =====
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,proxy,hosting,query,mobile,timezone`);
        const data = await response.json();
        
        if (data.status === 'success') {
            results.details.country = data.country || 'Desconhecido';
            results.details.region = data.regionName || 'Desconhecido';
            results.details.city = data.city || 'Desconhecido';
            results.details.isp = data.isp || 'Desconhecido';
            results.details.org = data.org || 'Desconhecido';
            results.details.isProxy = data.proxy === true;
            results.details.isDatacenter = data.hosting === true;
            results.details.methods.push('ip-api.com');
            
            if (data.proxy || data.hosting) {
                results.isVPN = true;
            }
        }
    } catch (e) {
        console.warn('ip-api.com falhou:', e.message);
    }

    // ===== MÉTODO 2: Verificar IP de datacenter (lista comum) =====
    const datacenterIPs = [
        'aws', 'amazon', 'azure', 'google cloud', 'digitalocean', 
        'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare',
        'akamai', 'fastly', 'cloudfront', 'heroku', 'vercel'
    ];
    
    const ispLower = (results.details.isp || '').toLowerCase();
    const orgLower = (results.details.org || '').toLowerCase();
    
    for (const dc of datacenterIPs) {
        if (ispLower.includes(dc) || orgLower.includes(dc)) {
            results.isVPN = true;
            results.details.methods.push('datacenter-list');
            results.details.isDatacenter = true;
            break;
        }
    }

    // ===== MÉTODO 3: ipapi.co (fallback) =====
    if (!results.isVPN) {
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            const data = await response.json();
            
            if (data && !data.error) {
                const isProxy = data.proxy === true;
                const isHosting = data.hosting === true;
                
                if (isProxy || isHosting) {
                    results.isVPN = true;
                    results.details.methods.push('ipapi.co');
                }
            }
        } catch (e) {
            console.warn('ipapi.co falhou:', e.message);
        }
    }

    // ===== MÉTODO 4: Verificar Cloudflare headers (indica VPN/Proxy) =====
    const cfHeaders = req.headers['cf-connecting-ip'] || req.headers['cf-ray'];
    if (cfHeaders) {
        // Pode ser VPN, mas não é conclusivo
        results.details.methods.push('cloudflare');
    }

    // ===== MÉTODO 5: Verificar VPN por localização (múltiplas localizações) =====
    // Se o IP está em um país diferente do esperado e é de datacenter
    if (results.details.isDatacenter && results.details.country !== 'Brazil') {
        results.isVPN = true;
        results.details.methods.push('vpn-by-location');
    }

    return results;
}
