FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto (Vite usa 5173 por defecto, Create React App usa 3000)
EXPOSE 5173

# Comando de desarrollo
CMD ["npm", "run", "dev", "--", "--host"]
