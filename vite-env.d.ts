/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * Chave da Google Drive API, usada para resolver a capa do post a partir da
     * pasta compartilhada. Definida no painel do Vercel e em .env.local (que o
     * .gitignore cobre via *.local) - nunca no codigo, porque o repo e publico.
     */
    readonly VITE_GOOGLE_DRIVE_API_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
