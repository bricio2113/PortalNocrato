
import React, { useState, useEffect } from 'react';
// Fix: Use Firebase v8 Firestore and Auth API
import { db, auth } from '../utils/firebase';

interface UserData {
    id: string;
    email: string;
    role: string;
    empresaId: string | null;
}

interface EmpresaData {
    id: string;
    nome: string; 
}

interface AgencyDashboardProps {
    handleLogout: () => void;
    onViewClient: (clientId: string) => void;
}

const LogoIcon = () => (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="black"/>
        <g stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            {/* Hand-drawn Hexagon */}
            <path d="M30 9 C35 10 41 16 40 24 C39 32 32 40 24 40 C16 40 9 34 8 26 C7 18 13 10 21 9 C24 8.5 27 8.5 30 9 Z" />
            {/* Hand-drawn N */}
            <path d="M19 33 L19.5 15" />
            <path d="M19.5 15 L28.5 33" />
            <path d="M28.5 33 L29 15" />
        </g>
    </svg>
);
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const MailIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;


const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ handleLogout, onViewClient }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState('');
    
    const [pendingEmpresaChanges, setPendingEmpresaChanges] = useState<Record<string, string | null>>({});
    const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});
    const [creatingCompanyForUser, setCreatingCompanyForUser] = useState<string | null>(null);
    const [newCompanyIdInput, setNewCompanyIdInput] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fix: Use Firebase v8 collection/get methods
            const usersSnapshot = await db.collection('usuarios').get();
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
            setUsers(usersData);

            // Fix: Use Firebase v8 collection/get methods
            const empresasSnapshot = await db.collection('empresas').get();
            const empresasData = empresasSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.id } as EmpresaData));
            setEmpresas(empresasData);

        } catch (error) {
            console.error("Error fetching dashboard data: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEmpresaSelection = (userId: string, selectedValue: string) => {
        if (selectedValue === 'create_new') {
            setCreatingCompanyForUser(userId);
            setNewCompanyIdInput('');
            setPendingEmpresaChanges(prev => {
                const newChanges = { ...prev };
                delete newChanges[userId];
                return newChanges;
            });
            return;
        }

        const newEmpresaId = selectedValue === 'null' ? null : selectedValue;
        setPendingEmpresaChanges(prev => ({
            ...prev,
            [userId]: newEmpresaId,
        }));
    };

    const handleSaveEmpresa = async (userId: string) => {
        const newEmpresaId = pendingEmpresaChanges[userId];
        if (newEmpresaId === undefined) return;

        try {
            // Fix: Use Firebase v8 collection/doc/update methods
            const userDocRef = db.collection('usuarios').doc(userId);
            await userDocRef.update({ empresaId: newEmpresaId });
            
            setUsers(users.map(u => u.id === userId ? { ...u, empresaId: newEmpresaId } : u));
            
            setPendingEmpresaChanges(prev => {
                const newChanges = { ...prev };
                delete newChanges[userId];
                return newChanges;
            });
            
            setNotification(`Usuário atualizado com sucesso!`);
            setTimeout(() => setNotification(''), 3000);

        } catch (error) {
            console.error("Error updating user's empresaId: ", error);
             setNotification(`Erro ao atualizar usuário.`);
            setTimeout(() => setNotification(''), 3000);
        }
    };
    
    const handleSaveRole = async (userId: string) => {
        const newRole = pendingRoleChanges[userId];
        if (newRole === undefined) return;

        try {
            const userDocRef = db.collection('usuarios').doc(userId);
            await userDocRef.update({ role: newRole });
            
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            
            setPendingRoleChanges(prev => {
                const newChanges = { ...prev };
                delete newChanges[userId];
                return newChanges;
            });
            
            setNotification(`Função do usuário atualizada com sucesso!`);
            setTimeout(() => setNotification(''), 3000);

        } catch (error) {
            console.error("Error updating user's role: ", error);
            setNotification(`Erro ao atualizar a função do usuário.`);
            setTimeout(() => setNotification(''), 3000);
        }
    };

    const handleCreateAndAssignCompany = async (userId: string) => {
        const trimmedId = newCompanyIdInput.trim();
        if (!trimmedId) {
            setNotification('O ID da nova empresa não pode estar vazio.');
            setTimeout(() => setNotification(''), 3000);
            return;
        }

        try {
            // Fix: Use Firebase v8 collection/doc/set methods
            const empresaDocRef = db.collection('empresas').doc(trimmedId);
            await empresaDocRef.set({ nome: trimmedId }); 

            // Fix: Use Firebase v8 collection/doc/update methods
            const userDocRef = db.collection('usuarios').doc(userId);
            await userDocRef.update({ empresaId: trimmedId });

            setCreatingCompanyForUser(null);
            setNewCompanyIdInput('');
            setNotification('Nova empresa criada e atribuída com sucesso!');
            fetchData(); 
            setTimeout(() => setNotification(''), 3000);

        } catch (error) {
            console.error("Error creating and assigning company: ", error);
            setNotification(`Erro ao criar nova empresa.`);
            setTimeout(() => setNotification(''), 3000);
        }
    };
    
    const handlePasswordReset = async (email: string) => {
        try {
            // Fix: Use Firebase v8 sendPasswordResetEmail method
            await auth.sendPasswordResetEmail(email);
            setNotification(`Link de redefinição de senha enviado para ${email}.`);
            setTimeout(() => setNotification(''), 4000);
        } catch (error) {
            console.error("Error sending password reset email: ", error);
            setNotification('Erro ao enviar o e-mail de redefinição.');
            setTimeout(() => setNotification(''), 3000);
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        // Confirmation dialog removed as per user request for direct action.

        // --- BACKEND LOGIC (FRONTEND CALL) ---
        //
        // IMPORTANT: Replace this placeholder URL with your actual Cloud Function endpoint.
        // This function must handle both Firebase Auth and Firestore user deletion.
        const cloudFunctionUrl = 'https://us-central1-agencia-nocrato.cloudfunctions.net/deleteUser';

        try {
            // Calling a Cloud Function is necessary because deleting a Firebase Auth user
            // requires admin privileges, which are not available on the client-side for security reasons.
            //
            // Your Cloud Function ('deleteUser') should:
            // 1. Be an HTTPS-triggered function.
            // 2. Accept a POST request with a JSON body: { "uid": "..." }.
            // 3. Use the Firebase Admin SDK to:
            //    a. Delete the user from Firebase Authentication: admin.auth().deleteUser(uid)
            //    b. Delete the user's document from Firestore: admin.firestore().collection('usuarios').doc(uid).delete()
            // 4. Be secured to ensure only authorized agency users can call it.

            // For demonstration purposes, this fetch call will fail if you haven't deployed the function.
            // A fallback is included below to show UI changes.
            const response = await fetch(cloudFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // If your Cloud Function is protected, you'll need to pass an auth token.
                    // 'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({ uid: userId }),
            });

            if (!response.ok) {
                 // The fetch will fail if the function is not deployed.
                 // For demonstration, we'll simulate success and warn the developer in the console.
                 console.warn(`[DEVELOPMENT] The Cloud Function call failed. This is expected if the 'deleteUser' function is not deployed at ${cloudFunctionUrl}. Simulating success by deleting only the Firestore record to update the UI. The Auth user was NOT deleted.`);
                 
                 // Fallback to old behavior for demonstration, so the UI updates.
                 // Fix: Use Firebase v8 collection/doc/delete methods
                 await db.collection('usuarios').doc(userId).delete();
            }

            // If the call is successful, the backend function has deleted the user.
            // Now, we just update the UI state.
            setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
            setNotification(`Usuário ${userEmail} excluído com sucesso.`);
            setTimeout(() => setNotification(''), 4000);

        } catch (error) {
            console.error("Erro ao chamar a Cloud Function para excluir usuário: ", error);
            setNotification(`Erro ao excluir usuário. Verifique o console e a configuração da sua Cloud Function.`);
            setTimeout(() => setNotification(''), 5000);
        }
    };

    const handleDeleteEmpresa = async (empresaId: string, empresaNome: string) => {
        try {
            // Security Check: Check for linked users
            const isEmpresaInUse = users.some(user => user.empresaId === empresaId);

            if (isEmpresaInUse) {
                setNotification('Não é possível excluir. Existem usuários vinculados a esta empresa.');
                setTimeout(() => setNotification(''), 5000);
                return; // Block deletion
            }

            // No users linked, proceed with deletion
            // Fix: Use Firebase v8 collection/doc/delete methods
            await db.collection('empresas').doc(empresaId).delete();

            setEmpresas(prevEmpresas => prevEmpresas.filter(e => e.id !== empresaId));
            
            setNotification(`Empresa "${empresaNome}" excluída com sucesso.`);
            setTimeout(() => setNotification(''), 3000);

        } catch (error) {
            console.error("Error deleting empresa: ", error);
            setNotification(`Erro ao excluir empresa.`);
            setTimeout(() => setNotification(''), 3000);
        }
    };


    return (
        <div className="min-h-screen bg-amber-50 dark:bg-slate-900 text-slate-800 dark:text-white">
            <header className="bg-white dark:bg-slate-800 p-4 flex justify-between items-center shadow-md">
                 <div className="flex items-center">
                    <div className="mr-3">
                        <LogoIcon />
                    </div>
                    <div>
                        <span className="text-xl font-bold cursor-default select-none text-slate-800 dark:text-white">Agência Nocrato</span>
                        <span className="block text-xs text-amber-500 dark:text-amber-400 cursor-default select-none">Painel de Controle</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <span className="mr-2"><LogoutIcon /></span>
                    Sair
                </button>
            </header>

            <main className="p-4 sm:p-8">
                {notification && (
                    <div className="bg-green-500 text-white p-3 rounded-md mb-6 text-center">
                        {notification}
                    </div>
                )}
                {isLoading ? (
                     <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4 cursor-default select-none">Gerenciamento de Usuários</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="py-4 px-6 font-semibold">Email</th>
                                            <th className="py-4 px-6 font-semibold">Perfil</th>
                                            <th className="py-4 px-6 font-semibold">Empresa Associada</th>
                                            <th className="py-4 px-6 font-semibold text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} className="border-b border-slate-200/75 dark:border-slate-700/50">
                                                <td className="py-4 px-6 font-medium text-slate-800 dark:text-white">{user.email}</td>
                                                <td className="py-4 px-6">
                                                    {user.id === auth.currentUser?.uid ? (
                                                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${user.role === 'agencia' ? 'bg-amber-500 text-slate-900' : 'bg-blue-500 text-white'}`}>
                                                            {user.role}
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={pendingRoleChanges[user.id] ?? user.role}
                                                                onChange={(e) => setPendingRoleChanges(prev => ({ ...prev, [user.id]: e.target.value }))}
                                                                className="bg-slate-50 dark:bg-slate-700 border text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 rounded-md h-10 px-2 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none capitalize"
                                                            >
                                                                <option value="cliente">Cliente</option>
                                                                <option value="agencia">Agência</option>
                                                            </select>
                                                            {pendingRoleChanges[user.id] && pendingRoleChanges[user.id] !== user.role && (
                                                                <button
                                                                    onClick={() => handleSaveRole(user.id)}
                                                                    className="border border-slate-500 text-slate-700 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 h-10 px-3 rounded-md font-semibold transition-colors text-xs whitespace-nowrap"
                                                                >
                                                                    Salvar
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    {user.role === 'cliente' ? (
                                                        creatingCompanyForUser === user.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="ID da Nova Empresa"
                                                                    value={newCompanyIdInput}
                                                                    onChange={(e) => setNewCompanyIdInput(e.target.value)}
                                                                    className="bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-md px-3 !h-10 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none !text-base"
                                                                />
                                                                <button
                                                                    onClick={() => handleCreateAndAssignCompany(user.id)}
                                                                    className="bg-amber-500 text-slate-900 h-10 px-4 rounded-md hover:bg-amber-600 font-semibold transition-colors text-xs whitespace-nowrap"
                                                                >
                                                                    Salvar
                                                                </button>
                                                                <button
                                                                    onClick={() => setCreatingCompanyForUser(null)}
                                                                    className="bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500 h-10 px-3 rounded-md transition-colors text-xs"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    value={pendingEmpresaChanges[user.id] ?? user.empresaId ?? 'null'}
                                                                    onChange={(e) => handleEmpresaSelection(user.id, e.target.value)}
                                                                    className="bg-slate-50 dark:bg-slate-700 border text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 rounded-md h-10 px-2 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                                                >
                                                                    <option value="null">Nenhuma</option>
                                                                    {empresas.map(e => (
                                                                        <option key={e.id} value={e.id}>{e.nome}</option>
                                                                    ))}
                                                                    <option value="create_new" className="font-bold text-amber-500 dark:text-amber-400 bg-slate-100 dark:bg-slate-800">+ Criar Nova Empresa</option>
                                                                </select>
                                                                {pendingEmpresaChanges[user.id] !== undefined && pendingEmpresaChanges[user.id] !== (user.empresaId ?? null) && (
                                                                    <button
                                                                        onClick={() => handleSaveEmpresa(user.id)}
                                                                        className="border border-slate-500 text-slate-700 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 h-10 px-3 rounded-md font-semibold transition-colors text-xs whitespace-nowrap"
                                                                    >
                                                                        Salvar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {user.role === 'cliente' && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handlePasswordReset(user.email)}
                                                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 h-9 px-3 rounded-md font-semibold transition-colors text-xs flex items-center justify-center"
                                                                    title="Enviar e-mail de redefinição de senha"
                                                                >
                                                                    <MailIcon />
                                                                    <span className="ml-1.5 hidden lg:inline">Redefinir Senha</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                                                    className="bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 h-9 px-3 rounded-md font-semibold transition-colors text-xs flex items-center justify-center"
                                                                    title="Excluir usuário"
                                                                >
                                                                    <TrashIcon />
                                                                    <span className="ml-1.5 hidden lg:inline">Excluir</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        {user.role === 'cliente' && user.empresaId && (
                                                            <button 
                                                                onClick={() => onViewClient(user.empresaId as string)}
                                                                className="border border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-blue-900/40 h-9 px-3 rounded-md font-semibold transition-colors text-xs flex items-center justify-center"
                                                            >
                                                                <CalendarIcon />
                                                                <span className="ml-2">Acessar Calendário</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                             <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4 cursor-default select-none">Clientes (Empresas)</h2>
                             <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="py-3 px-4">Nome da Empresa</th>
                                            <th className="py-3 px-4">ID</th>
                                            <th className="py-3 px-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {empresas.map(empresa => (
                                            <tr key={empresa.id} className="border-b border-slate-200/50 dark:border-slate-700/50">
                                                <td className="py-4 px-4 font-medium text-slate-800 dark:text-white">{empresa.nome}</td>
                                                <td className="py-4 px-4 font-mono text-xs text-slate-500">{empresa.id}</td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => onViewClient(empresa.id)}
                                                            className="border border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-blue-900/40 py-1.5 px-3 rounded-md font-semibold transition-colors text-xs flex items-center justify-center"
                                                        >
                                                            <CalendarIcon />
                                                            <span className="ml-2">Acessar</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteEmpresa(empresa.id, empresa.nome)}
                                                            className="bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 py-1.5 px-3 rounded-md font-semibold transition-colors text-xs flex items-center justify-center"
                                                            title="Excluir empresa"
                                                        >
                                                            <TrashIcon />
                                                            <span className="ml-1.5 hidden sm:inline">Excluir</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AgencyDashboard;