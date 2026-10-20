# Imagem base Slim leve e segura (Debian Linux)
FROM node:22-slim

# Definir ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000

# Diretório de trabalho no container
WORKDIR /app

# Copiar arquivos de dependências e código da aplicação
COPY package*.json ./
COPY node_modules ./node_modules
COPY server.js ./
COPY public ./public
COPY data ./data

# Ajustar permissões para o usuário sem privilégios 'node'
RUN chown -R node:node /app

# Executar como usuário sem privilégios para isolamento total
USER node

# Expor a porta 3000
EXPOSE 3000

# Verificação de integridade periódica usando o fetch nativo do Node
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/rides').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Comando de inicialização
CMD ["node", "server.js"]
