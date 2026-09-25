'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Shield, Check, X, Trash2, Ban } from 'lucide-react'

export default function AdminScreen() {
  const [users, setUsers] = useState<any[]>([])

  // Busca todos os usuários em tempo real
  useEffect(() => {
    const q = query(collection(db, 'usuarios'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUsers(fetched)
    })
    return () => unsubscribe()
  }, [])

  // Função para mudar o status do usuário
  const updateUserStatus = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        status: newStatus
      })
    } catch (error) {
      console.error("Erro ao atualizar status", error)
    }
  }

  // Função para excluir o documento do usuário
  const deleteUser = async (userId: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário do banco?')) {
      try {
        await deleteDoc(doc(db, 'usuarios', userId))
      } catch (error) {
        console.error("Erro ao excluir", error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 pb-20">
      <header className="flex items-center gap-3 mb-8 pt-4">
        <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <Shield className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Painel Master</h1>
          <p className="text-sm text-zinc-400">Gerenciamento de Comunidade</p>
        </div>
      </header>

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row gap-4 md:items-center justify-between">
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{user.nome}</h3>
                {user.role === 'admin' && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400">{user.email}</p>
              
              <div className="mt-2 inline-flex">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                  user.status === 'aprovado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                  user.status === 'bloqueado' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {user.status || 'pendente'}
                </span>
              </div>
            </div>

            {/* Ações do Admin */}
            {user.role !== 'admin' && (
              <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t border-zinc-800 md:border-none">
                {user.status !== 'aprovado' && (
                  <button 
                    onClick={() => updateUserStatus(user.id, 'aprovado')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-sm transition-colors"
                  >
                    <Check className="h-4 w-4" /> Aprovar
                  </button>
                )}
                
                {user.status !== 'bloqueado' && (
                  <button 
                    onClick={() => updateUserStatus(user.id, 'bloqueado')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm transition-colors"
                  >
                    <Ban className="h-4 w-4" /> Bloquear
                  </button>
                )}

                <button 
                  onClick={() => deleteUser(user.id)}
                  className="flex-none flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors"
                  title="Excluir do Banco"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-10 text-zinc-500">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>
    </div>
  )
}