// /api/ban/index.js
import fs from 'fs';
import path from 'path';

// Caminho do arquivo JSON
const BAN_FILE = path.join(process.cwd(), 'api/ban/banned-ips.json');

// Função para ler a lista de IPs banidos
function getBannedIPs() {
    try {
        if (!fs.existsSync(BAN_FILE)) {
            // Criar arquivo padrão se não existir
            const defaultData = { banned: [] };
            fs.writeFileSync(BAN_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(BAN_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao ler arquivo de ban:', error);
        return { banned: [] };
    }
}

// Função para salvar a lista de IPs banidos
function saveBannedIPs(data) {
    try {
        fs.writeFileSync(BAN_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar arquivo de ban:', error);
        return false;
    }
}

// Função para verificar se um IP está banido
function isIPBanned(ip, bannedList) {
    return bannedList.find(ban => ban.ip === ip);
}

// API Handler
export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method } = req;

    // ===== GET - Listar todos os bans =====
    if (method === 'GET') {
        const data = getBannedIPs();
        
        // Se tiver parâmetro ?check=ip, verifica se está banido
        if (req.query.check) {
            const ip = req.query.check;
            const banned = isIPBanned(ip, data.banned);
            
            if (banned) {
                return res.status(200).json({
                    banned: true,
                    reason: banned.reason,
                    expires: banned.expires,
                    date: banned.date
                });
            }
            return res.status(200).json({ banned: false });
        }

        // Se tiver parâmetro ?list, retorna todos os bans
        if (req.query.list === 'all') {
            return res.status(200).json(data);
        }

        return res.status(200).json({
            total: data.banned.length,
            banned: data.banned
        });
    }

    // ===== POST - Adicionar um novo ban =====
    if (method === 'POST') {
        const { ip, reason, expires } = req.body;

        // Validar IP
        if (!ip) {
            return res.status(400).json({ error: 'IP é obrigatório' });
        }

        // Validação básica de IP
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ error: 'IP inválido' });
        }

        const data = getBannedIPs();

        // Verificar se IP já está banido
        if (isIPBanned(ip, data.banned)) {
            return res.status(400).json({ error: 'IP já está banido' });
        }

        // Adicionar ban
        const newBan = {
            ip,
            reason: reason || 'Uso indevido',
            date: new Date().toISOString(),
            expires: expires || null // null = permanente
        };

        data.banned.push(newBan);

        if (saveBannedIPs(data)) {
            return res.status(201).json({
                success: true,
                message: 'IP banido com sucesso',
                ban: newBan
            });
        }

        return res.status(500).json({ error: 'Erro ao salvar ban' });
    }

    // ===== DELETE - Remover um ban =====
    if (method === 'DELETE') {
        const { ip } = req.body || req.query;

        if (!ip) {
            return res.status(400).json({ error: 'IP é obrigatório' });
        }

        const data = getBannedIPs();
        const index = data.banned.findIndex(ban => ban.ip === ip);

        if (index === -1) {
            return res.status(404).json({ error: 'IP não encontrado na lista de banidos' });
        }

        data.banned.splice(index, 1);

        if (saveBannedIPs(data)) {
            return res.status(200).json({
                success: true,
                message: 'Ban removido com sucesso'
            });
        }

        return res.status(500).json({ error: 'Erro ao remover ban' });
    }

    // ===== Método não permitido =====
    return res.status(405).json({ error: 'Método não permitido' });
}