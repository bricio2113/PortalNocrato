import React, { useState, useEffect } from 'react';
import { db, auth } from '../utils/firebase';
import {
    LogOut, Calendar, Mail, Trash2, UserCog, Building2, Plus, Save,
    X, Search, ChevronDown, Loader2, Users, LayoutDashboard, Briefcase,
    ArrowRight, Shield, Link as LinkIcon, ClipboardList
} from 'lucide-react';
import favicon from '../assets/favicon.png';

interface UserData { id: string; email: string; role: string; empresaId: string | null; }
interface EmpresaData { id: string; nome: string; }

// PROPS ATUALIZADAS: Nova função onViewClientTasks
interface AgencyDashboardProps {
    handleLogout: () => void;
    onViewClient: (clientId: string) => void;
    onViewClientTasks: (clientId: string) => void; // NOVO PROP
}

const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-[#1A1A1A] p-6 rounded-sm border border-white/5 flex items-center justify-between hover:border-[#FABE01]/30 transition-colors group">
        <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white group-hover:text-[#FABE01] transition-colors">{value}</h3>
        </div>
        <div className={`p-3 rounded-full bg-white/5 text-${color}-500 group-hover:bg-[#FABE01]/10 group-hover:text-[#FABE01] transition-colors`}>
            <Icon className="w-6 h-6" />
        </div>
    </div>
);

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ handleLogout, onViewClient, onViewClientTasks }) => {
    // ... (Estados e useEffect mantidos IGUAIS, sem alteração) ...
    const [users, setUsers] = useState<UserData[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'team'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingEmpresaChanges, setPendingEmpresaChanges] = useState<Record<string, string | null>>({});
    const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});
    const [creatingCompanyForUser, setCreatingCompanyForUser] = useState<string | null>(null);
    const [newCompanyIdInput, setNewCompanyIdInput] = useState('');

    const fetchData = async () => { setIsLoading(true); try { const usersSnapshot = await db.collection('usuarios').get(); setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData))); const empresasSnapshot = await db.collection('empresas').get(); setEmpresas(empresasSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.id } as EmpresaData))); } catch (error) { console.error(error); } finally { setIsLoading(false); } };
    useEffect(() => { fetchData(); }, []);

    // ... (Handlers mantidos IGUAIS: handleDeleteUser, handleDeleteEmpresa, etc) ...
    const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 4000); };
    const handleDeleteUser = async (userId: string) => { if (!window.confirm("ATENÇÃO: Deseja remover este usuário?")) return; try { await db.collection('usuarios').doc(userId).delete(); setUsers(prev => prev.filter(u => u.id !== userId)); showNotification('Usuário removido.'); fetch('https://us-central1-agencia-nocrato.cloudfunctions.net/deleteUser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: userId }) }).catch(() => {}); } catch (error) { showNotification('Erro ao excluir.'); } };
    const handleDeleteEmpresa = async (empresaId: string) => { if (users.some(u => u.empresaId === empresaId)) return showNotification('Empresa tem usuários vinculados.'); if (!window.confirm("Excluir empresa?")) return; try { await db.collection('empresas').doc(empresaId).delete(); setEmpresas(prev => prev.filter(e => e.id !== empresaId)); showNotification('Empresa excluída.'); } catch (error) { showNotification('Erro ao excluir.'); } };
    const handleSaveRole = async (userId: string) => { const newRole = pendingRoleChanges[userId]; if(!newRole) return; try { await db.collection('usuarios').doc(userId).update({role: newRole}); setUsers(users.map(u => u.id===userId ? {...u, role: newRole} : u)); setPendingRoleChanges(prev=>{const n={...prev}; delete n[userId]; return n;}); showNotification('Atualizado!'); } catch(e){showNotification('Erro');} };
    const handleEmpresaSelection = (userId: string, val: string) => { if(val==='create_new'){ setCreatingCompanyForUser(userId); setNewCompanyIdInput(''); setPendingEmpresaChanges(prev=>{const n={...prev}; delete n[userId]; return n;}); return;} setPendingEmpresaChanges(prev=>({...prev, [userId]: val==='null'?null:val})); };
    const handleSaveEmpresa = async (userId: string) => { const newId = pendingEmpresaChanges[userId]; if(newId===undefined) return; try { await db.collection('usuarios').doc(userId).update({empresaId: newId}); setUsers(users.map(u => u.id===userId ? {...u, empresaId: newId} : u)); setPendingEmpresaChanges(prev=>{const n={...prev}; delete n[userId]; return n;}); showNotification('Vínculo atualizado!'); } catch(e){showNotification('Erro');} };
    const handleCreateAndAssignCompany = async (userId: string) => { if(!newCompanyIdInput.trim()) return showNotification('Nome inválido.'); try { await db.collection('empresas').doc(newCompanyIdInput).set({nome: newCompanyIdInput}); await db.collection('usuarios').doc(userId).update({empresaId: newCompanyIdInput}); setCreatingCompanyForUser(null); setNewCompanyIdInput(''); showNotification('Criado e vinculado!'); fetchData(); } catch(e){showNotification('Erro');} };
    const handlePasswordReset = async (email: string) => { try{await auth.sendPasswordResetEmail(email); showNotification(`Email enviado para ${email}`);} catch(e){showNotification('Erro ao enviar email');} };

    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredEmpresas = empresas.filter(e => e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="min-h-screen bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black flex flex-col">
            <header className="bg-[#111111] border-b border-white/5 sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
                {/* ... (Header mantido igual) ... */}
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={favicon} alt="Logo" className="h-10 w-auto brightness-0 invert" />
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                        <div><h1 className="text-lg font-bold text-white leading-none">Painel Administrativo</h1><p className="text-xs text-[#FABE01] mt-1 font-bold uppercase tracking-widest">Gestão Nocrato</p></div>
                    </div>
                    <div className="flex items-center gap-6"><div className="hidden md:block text-right"><p className="text-sm font-medium text-white">{auth.currentUser?.email}</p><p className="text-xs text-zinc-500">Administrador</p></div><button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white rounded-sm"><LogOut className="w-5 h-5" /></button></div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
                {notification && <div className="fixed top-24 right-4 z-50 bg-[#FABE01] text-black px-4 py-3 rounded-sm shadow-lg font-bold text-sm flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full animate-pulse" />{notification}</div>}

                {/* ... (Tabs mantidas iguais) ... */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-8 mb-8 border-b border-white/5 pb-2 sm:pb-0 overflow-x-auto">
                    {[{ id: 'overview', label: 'Visão Geral', icon: LayoutDashboard }, { id: 'clients', label: 'Clientes (Empresas)', icon: Briefcase }, { id: 'team', label: 'Equipe & Permissões', icon: Users }].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-2 pb-4 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#FABE01]' : 'text-zinc-500 hover:text-zinc-300'}`}><tab.icon className="w-4 h-4 mb-0.5" />{tab.label}{activeTab === tab.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FABE01]" />}</button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StatCard title="Total de Clientes" value={empresas.length} icon={Building2} color="yellow" />
                                    <StatCard title="Usuários Cadastrados" value={users.length} icon={Users} color="blue" />
                                    <StatCard title="Agências / Admins" value={users.filter(u => u.role === 'agencia').length} icon={Shield} color="green" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1A1A1A] border border-white/10 rounded-sm py-2 pl-9 pr-4 text-sm text-white focus:border-[#FABE01] outline-none" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredEmpresas.map(empresa => (
                                        <div key={empresa.id} className="bg-[#1A1A1A] border border-white/5 p-6 rounded-sm hover:border-[#FABE01]/50 group relative flex flex-col justify-between min-h-[160px]">
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="bg-[#FABE01]/10 p-2 rounded-sm text-[#FABE01]"><Building2 className="w-5 h-5" /></div>
                                                    <button onClick={() => handleDeleteEmpresa(empresa.id)} className="text-zinc-600 hover:text-red-500 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{empresa.nome}</h3>
                                                <p className="text-xs text-zinc-500 font-mono mb-4 truncate">ID: {empresa.id}</p>
                                            </div>

                                            {/* BOTÕES DE AÇÃO: CALENDÁRIO E PRODUÇÃO */}
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => onViewClient(empresa.id)} className="w-full py-2.5 bg-white/5 hover:bg-[#FABE01] hover:text-black text-white text-sm font-bold rounded-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                                    <Calendar className="w-4 h-4" /> Acessar Calendário
                                                </button>
                                                <button onClick={() => onViewClientTasks(empresa.id)} className="w-full py-2.5 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white text-sm font-bold rounded-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                                    <ClipboardList className="w-4 h-4" /> Ver Produção (Tasks)
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            // ... (Tab Team mantida igual) ...
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="relative w-full max-w-md"><Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" /><input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1A1A1A] border border-white/10 rounded-sm py-2 pl-9 pr-4 text-sm text-white focus:border-[#FABE01] outline-none" /></div>
                                <div className="bg-[#1A1A1A] border border-white/5 rounded-sm overflow-hidden shadow-2xl"><div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[800px]"><thead className="bg-black/40 border-b border-white/5"><tr><th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Usuário</th><th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Permissão</th><th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Vínculo</th><th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/5">{filteredUsers.map(user => (<tr key={user.id} className="hover:bg-white/[0.02]"><td className="px-6 py-4 font-medium text-zinc-300">{user.email}</td><td className="px-6 py-4">{user.id === auth.currentUser?.uid ? <span className="text-[#FABE01] text-xs">ADMIN</span> : <div className="flex items-center gap-2"><select value={pendingRoleChanges[user.id]??user.role} onChange={(e)=>setPendingRoleChanges(prev=>({...prev, [user.id]: e.target.value}))} className="bg-[#0a0a0a] border border-zinc-700 text-zinc-300 text-xs rounded-sm p-1.5 outline-none"><option value="cliente">Cliente</option><option value="agencia">Agência</option></select>{pendingRoleChanges[user.id] && <button onClick={()=>handleSaveRole(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4"/></button>}</div>}</td><td className="px-6 py-4">{user.role === 'agencia' ? <span className="text-zinc-500 text-xs italic">Global</span> : creatingCompanyForUser===user.id ? <div className="flex gap-2"><input value={newCompanyIdInput} onChange={e=>setNewCompanyIdInput(e.target.value)} className="bg-[#0a0a0a] border border-[#FABE01] text-white text-xs p-1 w-24 outline-none"/><button onClick={()=>handleCreateAndAssignCompany(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4"/></button><button onClick={()=>setCreatingCompanyForUser(null)} className="text-red-400"><X className="w-4 h-4"/></button></div> : <div className="flex items-center gap-2"><select value={pendingEmpresaChanges[user.id]??user.empresaId??'null'} onChange={(e)=>handleEmpresaSelection(user.id,e.target.value)} className="bg-[#0a0a0a] border border-zinc-700 text-zinc-300 text-xs rounded-sm p-1.5 max-w-[140px] outline-none"><option value="null">--</option>{empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}<option value="create_new" className="text-[#FABE01]">+ Nova</option></select>{pendingEmpresaChanges[user.id]!==undefined && <button onClick={()=>handleSaveEmpresa(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4"/></button>}</div>}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handlePasswordReset(user.email)} className="p-2 text-zinc-400 hover:text-white" title="Senha"><Mail className="w-4 h-4"/></button>{user.id !== auth.currentUser?.uid && <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-zinc-400 hover:text-red-400" title="Excluir"><Trash2 className="w-4 h-4"/></button>}</div></td></tr>))}</tbody></table></div></div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default AgencyDashboard;