# 🚀 Guia de Deploy em Produção: BI Planner Pro
Este guia contém as instruções passo a passo detalhadas para implantar e publicar a plataforma **BI Planner Pro** em ambiente de produção público utilizando exclusivamente a infraestrutura gratuita do Google: **Firebase Hosting** como o frontend oficial de alta performance (CDN) e **Google Cloud Run** como o backend de APIs escalável (com scale-to-zero).

---

## 📋 Sumário
1. [Arquitetura de Produção](#1-arquitetura-de-produção)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo a Passo de Implantação](#3-passo-a-passo-de-implantação)
   - [Etapa A: Configuração do Google Cloud SDK & Firebase CLI](#etapa-a-configuração-do-google-cloud-sdk--firebase-cli)
   - [Etapa B: Compilação & Publicação do Backend (Cloud Run)](#etapa-b-compilação--publicação-do-backend-cloud-run)
   - [Etapa C: Compilação & Publicação do Frontend (Firebase Hosting)](#etapa-c-compilação--publicação-do-frontend-firebase-hosting)
4. [Configurações Adicionais no Console](#4-configurações-adicionais-no-console)
   - [Autorização de Domínios no Firebase Auth](#autorização-de-domínios-no-firebase-auth)
   - [Definição de Variáveis de Ambiente e Segredos](#definição-de-variáveis-de-ambiente-e-segredos)
5. [Checklist de Homologação e Segurança (Production Checklist)](#5-checklist-de-homologação-e-segurança)

---

## 1. 🏗️ Arquitetura de Produção
Para garantir máxima velocidade, segurança e conformidade com as diretrizes do Google, a arquitetura está dividida em duas camadas independentes:

```
  USUÁRIO (Navegador)
         │
         ├───► Solicita Páginas Estáticas, JS, CSS, Imagens, Manifest (PWA)
         │     ▼
         │   [ Firebase Hosting CDN ] (https://studied-stock-306704.web.app)
         │
         └───► Solicita APIs Rest (/api/advisor, /api/backup-drive, /api/health)
               ▼
             [ Firebase Hosting Proxy Rewrite ]
               │
               ▼ (Interno do Google)
             [ Google Cloud Run Service ] (https://bi-planner-pro-xxxxxx.run.app)
               │
               ├─► [ Google Firestore ] (Durable Cloud Persistence)
               ├─► [ Firebase Authentication ] (Login com Google, SMS, E-mail)
               └─► [ Gemini AI API ] (Gemini 3.5 Flash - Consultor de BI)
```

- **Frontend Estático (Firebase Hosting)**: Os ativos construídos pelo Vite (`dist/`) são armazenados em cache global na rede de borda do Google (CDN). O carregamento é instantâneo e possui suporte nativo a HTTPS, PWA e compressão gzip/brotli.
- **Backend Dinâmico (Google Cloud Run)**: O servidor Express (`server.ts`) é empacotado em uma imagem Docker ultraleve e publicado no Cloud Run. O serviço escala automaticamente de $0$ a $N$ instâncias e desliga quando não há tráfego, mantendo os custos sob a cota gratuita.
- **Integração de Rede (Rewrites)**: Configuramos o `firebase.json` com regras de reescrita para que todas as chamadas feitas para `/api/**` sejam automaticamente roteadas pelo Google ao Cloud Run. Isso elimina completamente problemas de CORS e mantém o tráfego sob o mesmo domínio.

---

## 2. 🛡️ Pré-requisitos
Antes de iniciar o deploy, garanta que você possui instalado e configurado em sua máquina de desenvolvimento:
1. **Node.js** (versão 18 ou superior).
2. **Docker** instalado e ativo em segundo plano (necessário para criar a imagem do container do backend).
3. **Google Cloud SDK (gcloud CLI)** instalado. [Download gcloud](https://cloud.google.com/sdk/docs/install?hl=pt-br).
4. **Firebase CLI (firebase-tools)** instalado globalmente via npm:
   ```bash
   npm install -g firebase-tools
   ```
5. ID do Projeto Firebase/Google Cloud: `studied-stock-306704`

---

## 3. 🏁 Passo a Passo de Implantação

### Etapa A: Configuração do Google Cloud SDK & Firebase CLI

1. **Faça login na sua conta do Google Cloud e Firebase:**
   ```bash
   gcloud auth login
   gcloud auth configure-docker
   firebase login
   ```

2. **Defina o projeto padrão no gcloud CLI:**
   ```bash
   gcloud config set project studied-stock-306704
   ```

3. **Selecione o projeto no Firebase CLI:**
   ```bash
   firebase use studied-stock-306704
   ```

---

### Etapa B: Compilação & Publicação do Backend (Cloud Run)

Para colocar o backend REST de APIs em produção, vamos empacotá-lo e enviá-lo ao Google Cloud Registry (GCR) para em seguida implantá-lo no Cloud Run.

1. **Submeta a imagem Docker utilizando o Google Cloud Build (compilação remota na nuvem do Google):**
   ```bash
   gcloud builds submit --tag gcr.io/studied-stock-306704/bi-planner-pro
   ```

2. **Implante o container compilado no Google Cloud Run:**
   ```bash
   gcloud run deploy bi-planner-pro \
     --image gcr.io/studied-stock-306704/bi-planner-pro \
     --platform managed \
     --region us-east1 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY=INSIRA_SUA_CHAVE_AQUI,NODE_ENV=production
   ```
   *Nota: Substitua `INSIRA_SUA_CHAVE_AQUI` pela sua chave de API secreta do Gemini obtida no Google AI Studio.*

3. **Anote a URL gerada pelo Cloud Run** (ex: `https://bi-planner-pro-xxxxxx.a.run.app`).

---

### Etapa C: Compilação & Publicação do Frontend (Firebase Hosting)

O Firebase Hosting é configurado via arquivo `firebase.json` e `.firebaserc`. Ele fará o deploy da pasta `dist/` gerada pela build do Vite.

1. **Edite o arquivo `firebase.json` na raiz se a região do seu Cloud Run for diferente de `us-east1`.** Veja a propriedade `rewrites[0].run`:
   ```json
   "rewrites": [
     {
       "source": "/api/**",
       "run": {
         "serviceId": "bi-planner-pro",
         "region": "us-east1"
       }
     },
     ...
   ]
   ```

2. **Execute a build de produção no frontend:**
   ```bash
   npm run build
   ```
   *Isso gerará os ativos minificados na pasta `/dist`.*

3. **Implante as regras de segurança do Firestore (Security Rules):**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Implante o frontend no Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```

5. 🎉 **Sucesso!** O Firebase Hosting exibirá a URL oficial da sua aplicação, tipicamente:
   - **`https://studied-stock-306704.web.app`**
   - **`https://studied-stock-306704.firebaseapp.com`**

---

## 4. 🎛️ Configurações Adicionais no Console

### Autorização de Domínios no Firebase Auth
Para que o Login do Google, autenticação por E-mail/Senha e redefinições de senha funcionem perfeitamente no ambiente de produção público, você precisa cadastrar os domínios oficiais na lista de domínios autorizados do Firebase Console:

1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Selecione o projeto **studied-stock-306704**.
3. Vá em **Authentication** no menu lateral e acesse a aba **Settings (Configurações)**.
4. Clique em **Authorized Domains (Domínios Autorizados)**.
5. Verifique se os seguintes domínios estão listados (se não, clique em "Adicionar Domínio"):
   - `localhost`
   - `studied-stock-306704.web.app`
   - `studied-stock-306704.firebaseapp.com`
   - *Seu domínio personalizado futuramente (ex: `www.meubiplanner.com.br`)*

### Definição de Variáveis de Ambiente e Segredos
Por motivos de segurança, nunca armazene chaves de API secretas (como `GEMINI_API_KEY`) diretamente no código do repositório.
- **Chave de API do Gemini**: No Google Cloud Console, vá para o **Cloud Run**, selecione o serviço `bi-planner-pro`, clique em **Editar e implantar nova revisão**, navegue até **Variáveis de Ambiente** e insira com segurança a chave de API na variável `GEMINI_API_KEY`. Você também pode integrá-la com o **Google Secret Manager** para proteção máxima em nível corporativo.

---

## 🤖 Automação de CI/CD com GitHub Actions

O repositório já vem preparado com uma esteira de **Integração e Entrega Contínua (CI/CD)** automatizada usando o **GitHub Actions** (configurado em `.github/workflows/deploy.yml`).

Sempre que você realizar um `git push` para o branch `main` ou `master`, a esteira executará automaticamente as seguintes ações:
1. **Build do Backend**: Compila e empacota o container Node.js/Express.
2. **Publicação no Container Registry**: Envia a nova imagem de container de forma segura para o Google Container Registry (GCR).
3. **Deploy no Cloud Run**: Atualiza o serviço no Google Cloud Run mantendo as variáveis de ambiente sincronizadas.
4. **Deploy no Firebase (Database Migrations)**: Implanta as regras de segurança atualizadas do Firestore (`firestore.rules`).
5. **Deploy do Frontend**: Compila os ativos estáticos do frontend com o Vite e faz o deploy seguro para o Firebase Hosting CDN.

### 🔑 Segredos do GitHub (GitHub Secrets) para Configurar

Para que a esteira funcione, você precisa cadastrar duas chaves secretas no seu repositório do GitHub (em **Settings > Secrets and variables > Actions > New repository secret**):

1. **`GCP_SA_KEY`**: A chave JSON da Conta de Serviço (Service Account) do Google Cloud com permissões para gerenciar Cloud Run, Firebase Hosting e Firestore.
2. **`GEMINI_API_KEY`**: A chave secreta do Gemini AI obtida no Google AI Studio.

#### 🔧 Como criar a Conta de Serviço (`GCP_SA_KEY`):

Execute os seguintes comandos no terminal com a `gcloud CLI` para criar e obter a chave:

```bash
# 1. Criar a conta de serviço
gcloud iam service-accounts create github-deployer --display-name="GitHub CI/CD Deployer"

# 2. Conceder permissões necessárias de Administrador do Cloud Run, Storage, Artifact Registry e Firebase
gcloud projects add-iam-policy-binding studied-stock-306704 \
  --member="serviceAccount:github-deployer@studied-stock-306704.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding studied-stock-306704 \
  --member="serviceAccount:github-deployer@studied-stock-306704.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding studied-stock-306704 \
  --member="serviceAccount:github-deployer@studied-stock-306704.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding studied-stock-306704 \
  --member="serviceAccount:github-deployer@studied-stock-306704.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 3. Gerar o arquivo JSON de chave privada
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=github-deployer@studied-stock-306704.iam.gserviceaccount.com
```

Abra o arquivo `sa-key.json`, copie todo o seu conteúdo e cole-o como o valor do segredo **`GCP_SA_KEY`** no GitHub. *Nota: Exclua o arquivo `sa-key.json` de sua máquina após o processo para evitar vazamento de credenciais.*

---

## 5. 🔍 Checklist de Homologação e Segurança

### 🔒 Segurança e HTTPS obrigatório
- [x] O Firebase Hosting redireciona automaticamente todo tráfego HTTP para HTTPS seguro de forma nativa.
- [x] Os cabeçalhos HTTP de segurança estão ativos (`X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`).
- [x] O middleware de Rate Limiting está ativo no backend do Cloud Run, restringindo abusos (limite deslizante de 120 requisições/minuto por endereço IP).
- [x] As regras de segurança do Firestore (`firestore.rules`) garantem que os usuários só podem ler e escrever seus próprios dados usando a regra `allow read, write: if request.auth != null && request.auth.uid == userId;`.

### 📱 PWA (Progressive Web App)
- [x] O arquivo `manifest.json` está integrado e referenciado no cabeçalho do `index.html`.
- [x] Os ícones de alta resolução estão copiados para a pasta pública e mapeados no manifest.
- [x] A cor temática do navegador está configurada em `#4f46e5` para proporcionar uma experiência integrada semelhante a um aplicativo nativo.

### 🌐 SEO (Search Engine Optimization)
- [x] O arquivo `robots.txt` autoriza os rastreadores web e aponta diretamente para o sitemap.
- [x] O arquivo `sitemap.xml` possui a estrutura recomendada de metadados de indexação.
- [x] Tags Open Graph (`og:title`, `og:description`, `og:image`) configuradas no `index.html` para compartilhamento rico em redes sociais.

---
*Em caso de dúvidas ou necessidade de suporte corporativo, consulte a documentação oficial do Firebase Hosting ou os logs de execução do Google Cloud Run Console.*
