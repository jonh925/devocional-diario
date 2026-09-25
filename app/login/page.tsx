'use client'

import { useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { BookOpen, Mail, Lock, User } from 'lucide-react'

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        // Fluxo de Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        const userDoc = await getDoc(doc(db, 'usuarios', userCredential.user.uid))
        
        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (userData.status === 'pendente') {
            setError('Sua conta ainda está aguardando aprovação do administrador.')
            auth.signOut() // Desloga a pessoa na hora
          } else if (userData.status === 'bloqueado') {
            setError('Sua conta foi bloqueada.')
            auth.signOut()
          } else {
            // APROVADO! Aqui você redireciona pro Feed
            window.location.href = '/' 
          }
        }
      } else {
        // Fluxo de Cadastro (Novo usuário)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        
        // Cria o perfil no Firestore com status PENDENTE
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          nome: name,
          email: email,
          role: 'user', // O usuário comum
          status: 'pendente', // A trava!
          createdAt: new Date().toISOString()
        })
        
        setError('Cadastro realizado! Aguarde a aprovação do administrador para acessar.')
        auth.signOut()
        setIsLogin(true) // Volta pra tela de login
      }
    } catch (err: any) {
      setError('Erro na autenticação. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Devocional Diário</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isLogin ? 'Bem-vindo de volta' : 'Junte-se à comunidade'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Seu nome"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
            <input
              type="email"
              placeholder="E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
            <input
              type="password"
              placeholder="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl mt-2 transition-all flex items-center justify-center"
            style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)' }}
          >
            {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-sm text-zinc-400 mt-6 hover:text-emerald-400 transition-colors"
        >
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
        </button>
      </div>
    </div>
  )
}