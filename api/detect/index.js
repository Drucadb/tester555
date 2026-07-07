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

    // ===== DETECTAR NAVEGADOR ANÔNIMO =====
    const isPrivate = detectPrivateBrowsing(req);

    // ===== DETECTAR VPN/PROXY =====
    const vpnInfo = await detectVPN(ipFinal);

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

// ===== FUNÇÃO PARA DETECTAR NAVEGADOR ANÔNIMO =====
function detectPrivateBrowsing(req) {
    // Verificar headers comuns de navegadores anônimos
    const headers = req.headers;
    
    // Chrome Incognito
    if (headers['x-chrome-incognito']) {
        return true;
    }
    
    // Firefox Private
    if (headers['x-firefox-private']) {
        return true;
    }
    
    // Safari Private
    if (headers['x-safari-private']) {
        return true;
    }
    
    // Edge InPrivate
    if (headers['x-edge-inprivate']) {
        return true;
    }
    
    // Opera Private
    if (headers['x-opera-private']) {
        return true;
    }
    
    return false;
}

// ===== FUNÇÃO PARA DETECTAR VPN =====
async function detectVPN(ip) {
    try {
        // Método 1: ip-api.com (gratuito)
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,proxy,hosting,query`);
        const data = await response.json();
        
        if (data.status === 'success') {
            // Verificar indicadores de VPN/Proxy
            const isProxy = data.proxy === true;
            const isHosting = data.hosting === true;
            
            // Verificar se é um provedor de VPN comum
            const vpnProviders = ['VPN', 'Proxy', 'Hosting', 'Cloud', 'Data Center', 'Amazon', 'Google Cloud', 'Microsoft Azure', 'DigitalOcean'];
            const isVPNProvider = vpnProviders.some(provider => 
                (data.isp && data.isp.includes(provider)) || 
                (data.org && data.org.includes(provider))
            );
            
            // Verificar se é um IP de datacenter
            const isDatacenter = isHosting || isVPNProvider;
            
            return {
                isVPN: isProxy || isDatacenter,
                details: {
                    country: data.country || 'Desconhecido',
                    region: data.regionName || 'Desconhecido',
                    city: data.city || 'Desconhecido',
                    isp: data.isp || 'Desconhecido',
                    org: data.org || 'Desconhecido',
                    isProxy: isProxy,
                    isDatacenter: isDatacenter
                }
            };
        }
        
        // Se a API falhar, tentar método alternativo
        return await detectVPNAlternative(ip);
        
    } catch (error) {
        console.error('Erro ao detectar VPN:', error);
        // Fallback: método alternativo
        return await detectVPNAlternative(ip);
    }
}

// ===== MÉTODO ALTERNATIVO DE DETECÇÃO DE VPN =====
async function detectVPNAlternative(ip) {
    try {
        // API alternativa: ipapi.co
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await response.json();
        
        if (data && !data.error) {
            const isProxy = data.proxy === true;
            const isHosting = data.hosting === true;
            
            return {
                isVPN: isProxy || isHosting,
                details: {
                    country: data.country_name || 'Desconhecido',
                    region: data.region || 'Desconhecido',
                    city: data.city || 'Desconhecido',
                    isp: data.org || 'Desconhecido',
                    org: data.org || 'Desconhecido',
                    isProxy: isProxy,
                    isDatacenter: isHosting
                }
            };
        }
        
        // Se tudo falhar, retornar sem detecção
        return {
            isVPN: false,
            details: {
                country: 'Desconhecido',
                region: 'Desconhecido',
                city: 'Desconhecido',
                isp: 'Desconhecido',
                org: 'Desconhecido',
                isProxy: false,
                isDatacenter: false
            },
            error: 'Não foi possível verificar VPN'
        };
        
    } catch (error) {
        console.error('Erro na detecção alternativa:', error);
        return {
            isVPN: false,
            details: {
                country: 'Desconhecido',
                region: 'Desconhecido',
                city: 'Desconhecido',
                isp: 'Desconhecido',
                org: 'Desconhecido',
                isProxy: false,
                isDatacenter: false
            },
            error: 'Erro ao verificar VPN'
        };
    }
}