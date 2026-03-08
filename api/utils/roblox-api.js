// api/utils/roblox-api.js
const axios = require('axios');
const { calcularIdade } = require('./validadores');

class RobloxAPI {
    constructor(cookie) {
        this.cookie = cookie;
        this.headers = {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    async verificarCookie() {
        try {
            const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
                headers: this.headers,
                timeout: 10000
            });

            if (response.data && response.data.id) {
                return {
                    valido: true,
                    userId: response.data.id,
                    username: response.data.name,
                    displayName: response.data.displayName
                };
            }
            return { valido: false, erro: 'Cookie inválido' };
        } catch (error) {
            if (error.response) {
                if (error.response.status === 401) {
                    return { valido: false, erro: 'Cookie expirado ou inválido' };
                }
            }
            return { valido: false, erro: 'Erro ao validar cookie' };
        }
    }

    async getInfoConta() {
        try {
            // Verificar se o cookie é válido primeiro
            const auth = await this.verificarCookie();
            if (!auth.valido) return auth;

            // Buscar informações básicas da conta
            const response = await axios.get(`https://users.roblox.com/v1/users/${auth.userId}`, {
                headers: this.headers
            });

            const infoConta = response.data;
            
            // Calcular idade da conta
            const idade = calcularIdade(infoConta.created);

            return {
                valido: true,
                ...auth,
                created: infoConta.created,
                idadeConta: idade.texto,
                diasConta: idade.dias,
                ehRecente: idade.ehRecente,
                isBanned: infoConta.isBanned || false
            };

        } catch (error) {
            console.error('Erro ao buscar info da conta:', error);
            return { valido: false, erro: 'Erro ao buscar informações da conta' };
        }
    }
}

module.exports = RobloxAPI;