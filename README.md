# 🤖 Playwright with agents Planner/Generator/Healer

![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen)
![Playwright](https://img.shields.io/badge/Playwright-1.56-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 🚀 Visão Geral

Este projeto demonstra o novo poder do **Playwright 1.56**, que agora vem equipado com **agentes de IA integrados**:  
**Planner**, **Generator** e **Healer**.

Esses agentes tornam a automação de testes muito mais inteligente:
- **Planner**: analisa o site e gera um plano de testes em Markdown.  
- **Generator**: transforma o plano em código Playwright pronto para execução.  
- **Healer**: executa os testes e corrige automaticamente falhas de seletor, timeout e visibilidade.  

Tudo **rodando localmente**, sem custo e sem depender de serviços externos.

---

## 🧩 Requisitos

- Node.js 18 ou superior  
- NPM 9+  
- VS Code (opcional, para integração com MCP)  
- Playwright 1.56.1 ou superior  

---

## ⚙️ Instalação

```bash
git clone https://github.com/BrunoZanotta/playwright-with-agents-planner-generator-healer.git
cd playwright-with-agents
npm ci
npx playwright install --with-deps
```

---
🧠 Ativando os Agentes

Inicialize os agentes de IA do Playwright:
```bash
npx playwright init-agents --loop=vscode
```

Esse comando cria automaticamente:

      • .vscode/mcp.json
	  •	.github/chatmodes/🎭 planner.chatmode.md
	  •	.github/chatmodes/🎭 generator.chatmode.md
	  •	.github/chatmodes/🎭 healer.chatmode.md


---

🧪 Rodando os Agentes
1️⃣ Planner – gerar plano de testes
```bash
npx playwright agent planner --site=https://www.saucedemo.com --instructions="Plano POM: login, catálogo, carrinho, checkout."
```

2️⃣ Generator – criar os testes
```bash
npx playwright agent generator --plan=plan.md
```

3️⃣ Healer – corrigir testes com falha
```bash
npx playwright agent healer
```

---

🧬 Executando os Testes
Rode todos os testes:

Rode todos os testes:
```bash
npx playwright test
```

Abra o relatório HTML:
```bash
npx playwright show-report
```

---

🔗 Referências
- [📘 Documentação Playwright](https://playwright.dev/docs/intro)
- [🧩 Notas da versão 1.56](https://playwright.dev/docs/release-notes#version-156)

---

👨‍💻 Autor

  Bruno Zanotta - QA Automation Specialist | AI | Quality Engineering - [LinkedIn](https://www.linkedin.com/in/bruno-zanotta-qa/)



