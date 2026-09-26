'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { BookOpen, Check, Heart, HandHeart, PenLine, Sparkles, Loader2, LogOut, Shield, X, Edit2, Trash2, MessageCircle, Send, Sun, Moon } from 'lucide-react'

import { hasForbiddenWords } from '@/lib/badwords'

export default function Page() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // ESTADO DO TEMA (Modo Claro / Escuro)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [readingPostId, setReadingPostId] = useState<string | null>(null)
  
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  
  const [formData, setFormData] = useState({ title: '', verse: '', reference: '', content: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Verifica Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (userData.status === 'pendente' || userData.status === 'bloqueado') {
            await auth.signOut()
            router.push('/login')
          } else {
            setCurrentUser({ uid: user.uid, ...userData })
            setIsLoading(false)
          }
        } else {
          await auth.signOut()
          router.push('/login')
        }
      } catch (error) {
        console.error("Erro ao verificar usuário:", error)
        router.push('/login')
      }
    })
    return () => unsubscribe()
  }, [router])

  // Busca Devocionais em Tempo Real
  useEffect(() => {
    if (!currentUser) return

    const q = query(collection(db, 'devocionais'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPosts(fetched)
    })
    return () => unsubscribe()
  }, [currentUser])

  // Busca Comentários do Post Aberto
  useEffect(() => {
    if (!readingPostId) {
      setComments([])
      return
    }

    const q = query(
      collection(db, 'devocionais', readingPostId, 'comentarios'), 
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setComments(fetched)
    })
    
    return () => unsubscribe()
  }, [readingPostId])

  // NOVO: Carrega o Tema Salvo
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (storedTheme) {
      setTheme(storedTheme)
      if (storedTheme === 'light') {
        document.documentElement.classList.remove('dark')
      } else {
        document.documentElement.classList.add('dark')
      }
    } else {
      // Padrão do app é escuro
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
  }, [])

  // NOVO: Alterna o Tema
  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setTheme('light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setTheme('dark')
    }
  }

  const toggleInteraction = async (postId: string, field: 'likedBy' | 'prayedBy', isCurrentlyActive: boolean) => {
    if (!currentUser) return
    const postRef = doc(db, 'devocionais', postId)
    
    try {
      await updateDoc(postRef, {
        [field]: isCurrentlyActive ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      })
    } catch (error) {
      console.error(`Erro ao interagir com ${field}:`, error)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUser || !readingPostId) return

    if (hasForbiddenWords(newComment)) {
      alert("Por favor, revise a sua mensagem. Algumas palavras não são permitidas em nossa comunidade.")
      return
    }
    
    setIsSubmittingComment(true)
    try {
      await addDoc(collection(db, 'devocionais', readingPostId, 'comentarios'), {
        text: newComment.trim(),
        authorName: currentUser.nome,
        authorId: currentUser.uid,
        createdAt: serverTimestamp()
      })
      setNewComment('')
    } catch (error) {
      console.error("Erro ao comentar:", error)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const openNewPostModal = () => {
    setEditingId(null)
    setFormData({ title: '', verse: '', reference: '', content: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (post: any) => {
    setEditingId(post.id)
    setFormData({ 
      title: post.title, 
      verse: post.verse || '', 
      reference: post.reference || '', 
      content: post.content 
    })
    setIsModalOpen(true)
  }

  const handleDeletePost = async (postId: string) => {
    if (confirm('Tem certeza que deseja apagar este devocional?')) {
      try {
        await deleteDoc(doc(db, 'devocionais', postId))
        if (readingPostId === postId) setReadingPostId(null)
      } catch (error) {
        console.error("Erro ao excluir:", error)
      }
    }
  }

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.content || !currentUser) return

    if (hasForbiddenWords(formData.title) || hasForbiddenWords(formData.content)) {
      alert("Por favor, revise o seu texto. Algumas palavras utilizadas não são permitidas em nossa comunidade.")
      return
    }

    setIsSubmitting(true)

    try {
      const postData = {
        title: formData.title,
        verse: formData.verse,
        reference: formData.reference,
        content: formData.content,
      }

      if (editingId) {
        await updateDoc(doc(db, 'devocionais', editingId), postData)
      } else {
        await addDoc(collection(db, 'devocionais'), {
          ...postData,
          authorName: currentUser.nome,
          authorId: currentUser.uid,
          likedBy: [],
          prayedBy: [],
          createdAt: serverTimestamp()
        })
      }
      
      setFormData({ title: '', verse: '', reference: '', content: '' })
      setEditingId(null)
      setIsModalOpen(false)
    } catch (error) {
      console.error("Erro ao salvar:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await auth.signOut()
    router.push('/login')
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const names = name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Agora mesmo'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </main>
    )
  }

  const readingPost = posts.find(p => p.id === readingPostId)

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-zinc-200 dark:border-white/[0.06] bg-white/80 dark:bg-zinc-950/90 backdrop-blur-xl transition-colors duration-300">
        <div className="mx-auto flex h-[72px] max-w-2xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <BookOpen aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Comunidade</p>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Devocional</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            
            {/* BOTÃO DE TEMA CLARO/ESCURO */}
            <button 
              onClick={toggleTheme} 
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors rounded-full"
              title="Alternar tema"
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>

            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => router.push('/admin')}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95"
              >
                <Shield className="size-4" />
                <span>Admin</span>
              </button>
            )}

            <button onClick={handleLogout} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors p-2">
              <LogOut className="size-5" />
            </button>
            <button className="rounded-full p-0.5 transition hover:ring-2 hover:ring-emerald-400/40 ml-1">
              <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-700 text-sm font-bold text-zinc-950">
                {getInitials(currentUser?.nome)}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-28 pt-[104px] sm:px-6">
        <section className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles aria-hidden="true" className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Seu momento com Deus</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">Inspire-se hoje.</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">Uma palavra compartilhada pode transformar o dia de alguém.</p>
        </section>

        <section className="flex flex-col gap-4">
          {posts.length === 0 ? (
            <div className="text-center py-12 rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 transition-colors">
              <p className="text-zinc-500 dark:text-zinc-400">Nenhum devocional postado ainda.</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 cursor-pointer font-medium" onClick={openNewPostModal}>Seja o primeiro a compartilhar!</p>
            </div>
          ) : (
            posts.map((post) => {
              const isLiked = post.likedBy?.includes(currentUser?.uid) || false
              const isPrayed = post.prayedBy?.includes(currentUser?.uid) || false
              const likesCount = post.likedBy?.length || 0
              const canEditOrDelete = currentUser?.uid === post.authorId || currentUser?.role === 'admin'
              
              return (
                <article key={post.id} className="rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-5 shadow-xl shadow-zinc-200/50 dark:shadow-2xl dark:shadow-black/10 transition hover:border-emerald-400/30 sm:p-6 duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                        {getInitials(post.authorName)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{post.authorName}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{formatDate(post.createdAt)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Reflexão</span>
                      
                      {canEditOrDelete && (
                        <>
                          <button onClick={() => openEditModal(post)} className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Editar">
                            <Edit2 className="size-4" />
                          </button>
                          <button onClick={() => handleDeletePost(post.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Apagar">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-white">{post.title}</h3>
                    
                    {post.verse && (
                      <div className="mt-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800/50">
                        <p className="text-sm italic text-zinc-700 dark:text-zinc-300 leading-relaxed">"{post.verse}"</p>
                        {post.reference && (
                          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-500">{post.reference}</p>
                        )}
                      </div>
                    )}

                    <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words line-clamp-3">
                      {post.content}
                    </p>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between border-t border-zinc-100 dark:border-white/[0.06] pt-4">
                    <button 
                      onClick={() => setReadingPostId(post.id)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition hover:text-emerald-500 dark:hover:text-emerald-300"
                    >
                      Ler devocional <span aria-hidden="true">→</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleInteraction(post.id, 'likedBy', isLiked)}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition font-medium ${isLiked ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-transparent dark:bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                      >
                        <Heart className="size-4" fill={isLiked ? 'currentColor' : 'none'} /> {likesCount}
                      </button>
                      <button 
                        onClick={() => toggleInteraction(post.id, 'prayedBy', isPrayed)}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition font-medium ${isPrayed ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-transparent dark:bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                      >
                        {isPrayed ? <Check className="size-4" /> : <HandHeart className="size-4" />} Amém
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>

      <button 
        onClick={openNewPostModal}
        className="fixed bottom-6 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-[0_0_28px_rgba(16,185,129,0.45)] transition hover:scale-105 hover:bg-emerald-400 active:scale-95 sm:right-8"
      >
        <PenLine className="size-6" />
      </button>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 p-4 backdrop-blur-sm transition-colors">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl transition-colors duration-300">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{editingId ? 'Editar Reflexão' : 'Compartilhar Reflexão'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handlePostSubmit} className="flex flex-col gap-4">
              <div>
                <input
                  type="text"
                  required
                  spellCheck={true}
                  placeholder="Título do devocional..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <textarea
                    rows={2}
                    spellCheck={true}
                    placeholder="Versículo bíblico (opcional)..."
                    value={formData.verse}
                    onChange={(e) => setFormData({ ...formData, verse: e.target.value })}
                    className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 text-sm italic transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    spellCheck={true}
                    placeholder="Referência..."
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <textarea
                  required
                  rows={6}
                  spellCheck={true}
                  placeholder="O que Deus tem falado ao seu coração hoje?"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-bold text-white dark:text-zinc-950 transition hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50"
                style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)' }}
              >
                {isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Devocional' : 'Publicar Devocional')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE LEITURA E COMENTÁRIOS */}
      {readingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 p-4 backdrop-blur-sm transition-colors">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-10 shadow-2xl transition-colors duration-300">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex size-10 items-center justify-center rounded-2xl text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    {getInitials(readingPost.authorName)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{readingPost.authorName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatDate(readingPost.createdAt)}</p>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl leading-tight">{readingPost.title}</h2>
              </div>
              
              <button onClick={() => setReadingPostId(null)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-white transition-colors flex-shrink-0">
                <X className="size-6" />
              </button>
            </div>

            <div className="mt-6">
              {readingPost.verse && (
                <div className="mb-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 p-5 sm:p-6 border border-zinc-200 dark:border-zinc-800/50">
                  <p className="text-lg italic text-zinc-700 dark:text-zinc-300 leading-relaxed">"{readingPost.verse}"</p>
                  {readingPost.reference && (
                    <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-500">{readingPost.reference}</p>
                  )}
                </div>
              )}

              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {readingPost.content}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-white/[0.06] pt-6">
              <button 
                onClick={() => toggleInteraction(readingPost.id, 'likedBy', readingPost.likedBy?.includes(currentUser?.uid))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm transition font-medium ${readingPost.likedBy?.includes(currentUser?.uid) ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-800'}`}
              >
                <Heart className="size-4" fill={readingPost.likedBy?.includes(currentUser?.uid) ? 'currentColor' : 'none'} /> Curtir ({readingPost.likedBy?.length || 0})
              </button>
              <button 
                onClick={() => toggleInteraction(readingPost.id, 'prayedBy', readingPost.prayedBy?.includes(currentUser?.uid))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm transition font-medium ${readingPost.prayedBy?.includes(currentUser?.uid) ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-zinc-200 dark:border-zinc-800'}`}
              >
                {readingPost.prayedBy?.includes(currentUser?.uid) ? <Check className="size-4" /> : <HandHeart className="size-4" />} Amém
              </button>
              <div className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 ml-auto">
                <MessageCircle className="size-4" /> {comments.length}
              </div>
            </div>

            {/* SEÇÃO DE COMENTÁRIOS */}
            <div className="mt-8 border-t border-zinc-100 dark:border-white/[0.06] pt-8">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">Comentários</h3>

              <form onSubmit={handleCommentSubmit} className="flex gap-3 mb-8">
                <input
                  type="text"
                  spellCheck={true}
                  placeholder="Deixe uma mensagem de apoio..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newComment.trim()}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 transition hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Send className="size-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              </form>

              <div className="flex flex-col gap-6">
                {comments.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-500 text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <span className="flex size-8 items-center justify-center rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        {getInitials(comment.authorName)}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{comment.authorName}</p>
                          <span className="text-[10px] text-zinc-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 break-words">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}