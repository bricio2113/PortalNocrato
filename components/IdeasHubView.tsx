import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { toSafeHref } from '../utils/url';

// Ícones Lucide
import {
  Folder, FileText, ExternalLink, Plus, Trash2,
  Link as LinkIcon, Image, FileSpreadsheet, DownloadCloud, Loader2
} from 'lucide-react';

interface DriveLink {
  id: string;
  title: string;
  url: string;
  category: 'Mídia' | 'Contratos' | 'Relatórios' | 'Outros';
  createdAt: Date;
}

interface IdeasHubViewProps {
  empresaId: string;
}

// Categorias disponíveis
const CATEGORIES = ['Mídia', 'Contratos', 'Relatórios', 'Outros'];

const IdeasHubView: React.FC<IdeasHubViewProps> = ({ empresaId }) => {
  // --- ESTADOS ---
  const [links, setLinks] = useState<DriveLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');

  // Estado do Formulário
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    category: 'Outros'
  });

  // --- BUSCAR DADOS ---
  useEffect(() => {
    if (!empresaId) return;

    // Tempo real: arquivo salvo pela agencia aparece na aba do cliente sozinho.
    setIsLoading(true);

    const unsubscribe = db.collection('empresas').doc(empresaId).collection('drive_links')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          setLinks(snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: (data.createdAt as firebase.firestore.Timestamp | undefined)?.toDate() || new Date()
            } as DriveLink;
          }));
          setIsLoading(false);
        },
        error => {
          console.error("Erro ao buscar links: ", error);
          setListError('Não foi possível carregar os arquivos. Verifique sua conexão.');
          setIsLoading(false);
        }
      );

    return unsubscribe;
  }, [empresaId]);

  // --- SALVAR NOVO LINK ---
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.url.trim()) return;

    // Normaliza e recusa esquemas perigosos antes de gravar.
    const formattedUrl = toSafeHref(formData.url);
    if (!formattedUrl) {
      setFormError('Link inválido. Use um endereço http:// ou https://.');
      return;
    }
    setFormError('');

    try {
      const collectionRef = db.collection('empresas').doc(empresaId).collection('drive_links');

      const newLinkObj = {
        title: formData.title,
        url: formattedUrl,
        category: formData.category,
        createdAt: new Date()
      };

      await collectionRef.add(newLinkObj);

      // Atualiza estado local

      // Limpa form
      setFormData({ title: '', url: '', category: 'Outros' });

    } catch (error) {
      console.error("Erro ao salvar link: ", error);
      // Sem isto a falha era invisivel: o formulario continuava preenchido e o
      // usuario nao sabia se tinha salvo ou nao.
      setFormError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
    }
  };

  // --- EXCLUIR LINK ---
  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja remover este link?")) return;
    setListError('');
    try {
      await db.collection('empresas').doc(empresaId).collection('drive_links').doc(id).delete();
    } catch (error) {
      console.error("Erro ao excluir", error);
      setListError('Não foi possível remover o link. Tente novamente.');
    }
  };

  // --- HELPER: Ícone por Categoria ---
  const getIconByCategory = (cat: string) => {
    switch (cat) {
      case 'Mídia': return <Image className="w-6 h-6 text-purple-400" />;
      case 'Contratos': return <FileText className="w-6 h-6 text-blue-400" />;
      case 'Relatórios': return <FileSpreadsheet className="w-6 h-6 text-green-400" />;
      default: return <Folder className="w-6 h-6 text-[#FABE01]" />;
    }
  };

  return (
      <div className="text-zinc-100 font-sans">

        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            <DownloadCloud className="w-8 h-8 text-[#FABE01]" />
            Arquivos & Materiais
          </h1>
          <p className="text-zinc-400 mt-2 text-lg max-w-2xl">
            Centralize links importantes, pastas do Drive e materiais de campanha em um só lugar.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* COLUNA 1: FORMULÁRIO DE ADIÇÃO */}
          <div className="lg:col-span-1">
            <div className="bg-[#1A1A1A] rounded-sm border border-white/5 p-6 sticky top-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FABE01]" />
                Adicionar Novo Link
              </h3>

              <form onSubmit={handleSaveLink} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Título do Arquivo</label>
                  <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="Ex: Pasta de Fotos Maio"
                      className="w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-2 text-white text-sm focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all placeholder:text-zinc-600"
                      required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Link (URL)</label>
                  <div className="relative">
                    <input
                        type="text"
                        value={formData.url}
                        onChange={(e) => setFormData({...formData, url: e.target.value})}
                        placeholder="drive.google.com/..."
                        className="w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-2 pl-9 text-white text-sm focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all placeholder:text-zinc-600"
                        required
                    />
                    <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
                  </div>
                  {formError && (
                      <p className="text-red-400 text-xs mt-1.5">{formError}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Categoria</label>
                  <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-2 text-white text-sm focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <button
                    type="submit"
                    disabled={!formData.title || !formData.url}
                    className="w-full bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-2.5 rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.1)] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar Arquivo
                </button>
              </form>
            </div>
          </div>

          {/* COLUNA 2: LISTA DE ARQUIVOS */}
          <div className="lg:col-span-2">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                  <p className="text-zinc-500 text-sm">Carregando arquivos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listError && (
                      <p className="col-span-full text-red-400 text-sm border border-red-500/20 bg-red-500/5 rounded-sm px-4 py-3">
                        {listError}
                      </p>
                  )}
                  {links.map(link => (
                      <div key={link.id} className="group bg-[#1A1A1A] border border-white/5 p-5 rounded-sm hover:border-[#FABE01]/30 transition-all flex flex-col justify-between min-h-[140px]">

                        {/* Topo do Card */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-white/5 rounded-sm group-hover:bg-[#FABE01]/10 transition-colors">
                            {getIconByCategory(link.category)}
                          </div>
                          <button
                              onClick={() => handleDelete(link.id)}
                              className="text-zinc-600 hover:text-red-500 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              title="Excluir Arquivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Info */}
                        <div>
                          <h4 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">{link.title}</h4>
                          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{link.category}</span>
                        </div>

                        {/* Botão Acessar - revalida o link vindo do banco */}
                        {toSafeHref(link.url) ? (
                            <a
                                href={toSafeHref(link.url)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full py-2 border border-white/10 hover:bg-[#FABE01] hover:border-[#FABE01] text-zinc-300 hover:text-black text-sm font-bold rounded-sm transition-all group/btn"
                            >
                              Acessar Drive
                              <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                            </a>
                        ) : (
                            <span className="mt-4 flex items-center justify-center w-full py-2 border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold rounded-sm">
                              Link inválido
                            </span>
                        )}
                      </div>
                  ))}

                  {links.length === 0 && (
                      <div className="col-span-full py-14 px-6 text-center border border-dashed border-white/10 rounded-sm">
                        <Folder className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                        <p className="text-zinc-300 font-bold mb-1">Nenhum arquivo salvo ainda</p>
                        {/* "ao lado" so era verdade no desktop: abaixo de lg o formulario
                            empilha acima da lista, e a instrucao apontava para o nada. */}
                        <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
                          Salve aqui pastas do Drive, contratos e relatórios para encontrar tudo em um só lugar — o formulário está <span className="lg:hidden">acima</span><span className="hidden lg:inline">ao lado</span>.
                        </p>
                      </div>
                  )}
                </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default IdeasHubView;