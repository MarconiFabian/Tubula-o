
# Isometrico Manager - VDC & BI Platform

**Desenvolvido por: Marconi Fabian**

O **Isometrico Manager** é uma plataforma avançada de engenharia para rastreabilidade de tubulação industrial e planejamento 4D. O sistema utiliza um motor gráfico 3D para transformar listas de materiais em modelos visuais interativos, permitindo o acompanhamento em tempo real do progresso físico da obra.

## 🚀 Tecnologias
- **Frontend:** React 19 + TypeScript
- **Gráficos 3D:** Three.js + React Three Fiber
- **Banco de Dados Cloud:** Supabase (PostgreSQL + JSONB)
- **Estilização:** Tailwind CSS
- **Relatórios:** jsPDF + html2canvas

## 🛠️ Configuração
1. Clone este repositório.
2. Configure as credenciais do seu projeto no arquivo `utils/supabaseClient.ts`.
3. Execute o script SQL (disponível na documentação interna) no seu console do Supabase para criar as tabelas `projects` e `app_users`.
4. Faça o deploy no Vercel vinculando este repositório.

## 📈 Funcionalidades
- Desenho de tubulação em tempo real (6m, 12m ou livre).
- Rastreabilidade de soldagem e status de montagem.
- Cálculo automático de saldo remanescente (H/H).
- Dashboard de BI com exportação de relatórios em PDF.
- Exportação de geometria 3D para AutoCAD (DXF).

---
© 2025 Marconi Fabian. Todos os direitos reservados.
