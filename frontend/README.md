# Limpeza Inteligente do Curral

Este pacote contém o código do dashboard demonstrativo. Os sensores, os
controles da bomba e o agendamento são simulados; não existe conexão com um
ESP32 nem controle de uma bomba real.

## Como abrir a demonstração

1. Extraia a pasta do arquivo ZIP.
2. Instale o Node.js 20.19 ou mais recente (ou 22.12+), caso ainda não esteja instalado.
3. Abra um terminal nesta pasta e execute:

   ```bash
   npm install
   npm run dev
   ```

4. Abra no navegador o endereço indicado no terminal, normalmente
   `http://localhost:5173`.

## Arquivos principais

- `src/pages/dashboard.tsx`: código da tela e dos controles simulados.
- `src/main.tsx`: ponto de entrada da aplicação.
- `src/index.css`: estilos e cores.
- `package.json`: dependências e comandos para executar.

Para compartilhar, envie a pasta inteira ou o arquivo
`limpeza-inteligente-dashboard.zip`.
