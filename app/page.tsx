'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db, messaging } from '@/lib/firebase'
import { getToken } from 'firebase/messaging'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore'
import { BookOpen, Check, Heart, HandHeart, PenLine, Sparkles, Loader2, LogOut, Shield, X, Edit2, Trash2, MessageCircle, Send, Sun, Moon, Bell, BellRing, Share2, Download, ChevronLeft, ChevronRight, Plus, Minus, Type } from 'lucide-react'
import { hasForbiddenWords, hasLinks } from '@/lib/badwords'
import { toPng } from 'html-to-image'

const AVATAR_COLORS = [
  { id: 'emerald', bg: 'from-emerald-300 to-emerald-700', text: 'text-emerald-950', label: 'Verde' },
  { id: 'blue', bg: 'from-blue-300 to-blue-700', text: 'text-blue-950', label: 'Azul' },
  { id: 'purple', bg: 'from-purple-300 to-purple-700', text: 'text-purple-950', label: 'Roxo' },
  { id: 'rose', bg: 'from-rose-300 to-rose-700', text: 'text-rose-950', label: 'Rosa' },
  { id: 'amber', bg: 'from-amber-300 to-amber-700', text: 'text-amber-950', label: 'Amarelo' },
  { id: 'indigo', bg: 'from-indigo-300 to-indigo-700', text: 'text-indigo-950', label: 'Índigo' }
]

const getAvatarClasses = (colorId: string) => {
  const color = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0]
  return `${color.bg} ${color.text}`
}

export default function Page() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [postLimit, setPostLimit] = useState(5)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [readingPostId, setReadingPostId] = useState<string | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState('emerald')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  
  // Estado para o tamanho da fonte (Conforto de Leitura)
  const [fontSize, setFontSize] = useState(16)

  const [formData, setFormData] = useState<{title: string, verse: string, reference: string, content: string[]}>({ 
    title: '', verse: '', reference: '', content: [''] 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [paginasAtuais, setPaginasAtuais] = useState<Record<string, number>>({})

  const mudarPagina = (postId: string, direcao: 'prox' | 'ant', maxPaginas: number) => {
    setPaginasAtuais(prev => {
      const paginaAtual = prev[postId] || 0
      let novaPagina = paginaAtual
      if (direcao === 'prox' && paginaAtual < maxPaginas - 1) novaPagina++
      if (direcao === 'ant' && paginaAtual > 0) novaPagina--
      return { ...prev, [postId]: novaPagina }
    })
  }

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
            setSelectedColor(userData.avatarColor || 'emerald')
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

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setIsIOS(true)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'devocionais'), orderBy('createdAt', 'desc'), limit(postLimit))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPosts(fetched)
      if (fetched.length < postLimit) setHasMore(false)
      else setHasMore(true)
      setIsLoadingMore(false)
    })
    return () => unsubscribe()
  }, [currentUser, postLimit])

  useEffect(() => {
    if (!readingPostId) {
      setComments([])
      return
    }
    const q = query(collection(db, 'devocionais', readingPostId, 'comentarios'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setComments(fetched)
    })
    return () => unsubscribe()
  }, [readingPostId])

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (storedTheme) {
      setTheme(storedTheme)
      if (storedTheme === 'light') document.documentElement.classList.remove('dark')
      else document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
  }, [])

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

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setDeferredPrompt(null)
    } else if (isIOS) {
      alert('Para instalar no iPhone:\n\n1. Toque no ícone de "Compartilhar" (quadrado com seta) na barra inferior do Safari.\n2. Role para baixo e escolha "Adicionar à Tela de Início".')
    } else {
      alert('Parece que o aplicativo já está instalado no seu dispositivo!')
    }
  }

  const handleNotificationToggle = async () => {
    if (!('Notification' in window)) {
      alert('Seu dispositivo ou navegador não suporta notificações web.')
      return
    }
    if (notificationsEnabled) {
      if (currentUser) {
        try {
          await updateDoc(doc(db, 'usuarios', currentUser.uid), { wantsNotifications: false })
          setNotificationsEnabled(false)
          alert('Notificações silenciadas! Você não será mais avisado.')
        } catch (error) {}
      }
      return
    }
    if (Notification.permission === 'default' || Notification.permission === 'granted') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        try {
          if (currentUser && messaging) {
            const currentToken = await getToken(messaging, { vapidKey: 'BDa7E_5oZrV7rM2ELCqoRCL3dXfCiXdB1uZXFw7wTC-dtSgVUrzd9kbQJgdJK7h1VWEtnpvygE-O5NT-g7_rkXY' })
            if (currentToken) {
              await updateDoc(doc(db, 'usuarios', currentUser.uid), { wantsNotifications: true, fcmToken: currentToken })
              setNotificationsEnabled(true)
              alert('Tudo certo! As notificações estão ativadas para este dispositivo.')
            }
          }
        } catch (error) {}
      } else {
        alert('Você negou a permissão. Não enviaremos notificações.')
      }
    } else {
      alert('Você bloqueou as notificações anteriormente. Para ativar, altere a permissão manualmente.')
    }
  }

  const handleUpdateProfile = async () => {
    if (!currentUser) return
    setIsUpdatingProfile(true)
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { avatarColor: selectedColor })
      setCurrentUser({ ...currentUser, avatarColor: selectedColor })
      setIsProfileModalOpen(false)
    } catch (error) {
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const toggleInteraction = async (postId: string, field: 'likedBy' | 'prayedBy', isCurrentlyActive: boolean) => {
    if (!currentUser) return
    const postRef = doc(db, 'devocionais', postId)
    try {
      await updateDoc(postRef, {
        [field]: isCurrentlyActive ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      })
    } catch (error) {}
  }

  const handleShare = async (postId: string, postTitle: string) => {
    const element = document.getElementById(`post-${postId}`)
    if (!element) return

    const textElement = element.querySelector('p.line-clamp-3')
    const actionFooter = element.querySelector('.post-actions')
    const carouselControls = element.querySelector('.carousel-controls')
    const adminButtons = element.querySelectorAll('button[title="Editar"], button[title="Apagar"]')

    try {
      if (textElement) textElement.classList.remove('line-clamp-3')
      if (actionFooter) (actionFooter as HTMLElement).style.display = 'none'
      if (carouselControls) (carouselControls as HTMLElement).style.display = 'none'
      adminButtons.forEach(btn => (btn as HTMLElement).style.display = 'none')

      await new Promise(resolve => setTimeout(resolve, 50))

      const dataUrl = await toPng(element, { 
        backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
        pixelRatio: 2,
        style: { margin: '0' } 
      })
      
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `devocional-${postId}.png`, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: postTitle,
          text: 'Leia a reflexão completa na nossa comunidade!',
          files: [file]
        })
      } else {
        const link = document.createElement('a')
        link.download = `devocional-${postId}.png`
        link.href = dataUrl
        link.click()
        alert('Imagem guardada! Agora já pode partilhar no seu Instagram.')
      }
    } catch (error) {
      console.error("Erro ao gerar imagem para partilha:", error)
      alert("Houve um erro ao tentar gerar a imagem.")
    } finally {
      if (textElement) textElement.classList.add('line-clamp-3')
      if (actionFooter) (actionFooter as HTMLElement).style.display = ''
      if (carouselControls) (carouselControls as HTMLElement).style.display = ''
      adminButtons.forEach(btn => (btn as HTMLElement).style.display = '')
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUser || !readingPostId) return

    if (hasForbiddenWords(newComment)) {
      alert("Por favor, revise a sua mensagem. Algumas palavras não são permitidas.")
      return
    }
    if (hasLinks(newComment)) {
      alert("Não é permitido enviar links na nossa comunidade.")
      return
    }

    setIsSubmittingComment(true)
    try {
      await addDoc(collection(db, 'devocionais', readingPostId, 'comentarios'), {
        text: newComment.trim(),
        authorName: currentUser.nome,
        authorId: currentUser.uid,
        authorColor: currentUser.avatarColor || 'emerald',
        createdAt: serverTimestamp()
      })
      setNewComment('')
    } catch (error) {
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const openNewPostModal = () => {
    setEditingId(null)
    setFormData({ title: '', verse: '', reference: '', content: [''] })
    setIsModalOpen(true)
  }

  const openEditModal = (post: any) => {
    setEditingId(post.id)
    setFormData({ 
      title: post.title, 
      verse: post.verse || '', 
      reference: post.reference || '', 
      content: Array.isArray(post.content) ? post.content : [post.content || ''] 
    })
    setIsModalOpen(true)
  }

  const handleDeletePost = async (postId: string) => {
    if (confirm('Tem certeza que deseja apagar este devocional?')) {
      try {
        await deleteDoc(doc(db, 'devocionais', postId))
        if (readingPostId === postId) setReadingPostId(null)
      } catch (error) {}
    }
  }

  const updateFormPage = (index: number, text: string) => {
    const newContent = [...formData.content]
    newContent[index] = text
    setFormData({ ...formData, content: newContent })
  }

  const addFormPage = () => {
    setFormData({ ...formData, content: [...formData.content, ''] })
  }

  const removeFormPage = (index: number) => {
    const newContent = formData.content.filter((_, i) => i !== index)
    setFormData({ ...formData, content: newContent })
  }

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validPages = formData.content.filter(p => p.trim() !== '')

    if (!formData.title || validPages.length === 0 || !currentUser) {
      alert("O título e pelo menos uma página de conteúdo são obrigatórios.")
      return
    }

    if (hasForbiddenWords(formData.title) || validPages.some(p => hasForbiddenWords(p))) {
      alert("Por favor, revise o seu texto. Algumas palavras não são permitidas.")
      return
    }
    if (hasLinks(formData.title) || validPages.some(p => hasLinks(p))) {
      alert("Não é permitido incluir links nos devocionais.")
      return
    }

    setIsSubmitting(true)
    try {
      const postData = {
        title: formData.title,
        verse: formData.verse,
        reference: formData.reference,
        content: validPages,
      }

      if (editingId) {
        await updateDoc(doc(db, 'devocionais', editingId), postData)
      } else {
        await addDoc(collection(db, 'devocionais'), {
          ...postData,
          authorName: currentUser.nome,
          authorId: currentUser.uid,
          authorColor: currentUser.avatarColor || 'emerald',
          likedBy: [],
          prayedBy: [],
          createdAt: serverTimestamp()
        })

        try {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: formData.title,
              authorName: currentUser.nome
            })
          })
        } catch (error) {}
      }
      
      setFormData({ title: '', verse: '', reference: '', content: [''] })
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
    if (names.length >= 2) return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Agora mesmo'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // Agrupamento de Posts por Data (Separadores de Tempo)
  const groupedPosts = posts.reduce((acc, post) => {
    const date = post.createdAt?.toDate ? post.createdAt.toDate() : new Date()
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let group = 'Anteriores'
    if (date.toDateString() === today.toDateString()) group = 'Hoje'
    else if (date.toDateString() === yesterday.toDateString()) group = 'Ontem'
    else group = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    if (!acc[group]) acc[group] = []
    acc[group].push(post)
    return acc
  }, {} as Record<string, any[]>)

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
      
      {/* Estilos Globais para Animações (Micro-interações) */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-slide { animation: fadeSlide 0.3s ease-out forwards; }
      `}</style>

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
          
          <div className="flex items-center gap-1 sm:gap-2">
            {(deferredPrompt || isIOS) && (
              <button 
                onClick={handleInstallApp}
                className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors rounded-full"
                title="Instalar Aplicativo"
              >
                <Download className="size-5" />
              </button>
            )}
            <button 
              onClick={handleNotificationToggle}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors rounded-full"
              title="Ativar Notificações"
            >
              {notificationsEnabled ? (
                <BellRing className="size-5 text-emerald-500" />
              ) : (
                <Bell className="size-5" />
              )}
            </button>
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
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95"
              >
                <Shield className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button onClick={handleLogout} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors p-2">
              <LogOut className="size-5" />
            </button>
            
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="rounded-full p-0.5 transition hover:ring-2 hover:ring-emerald-400/40 ml-1"
            >
              <span className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarClasses(currentUser?.avatarColor)} text-sm font-bold shadow-sm`}>
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

        {/* LISTAGEM DE POSTS COM SEPARADORES DE TEMPO */}
        <section className="flex flex-col">
          {posts.length === 0 ? (
            <div className="text-center py-12 rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 transition-colors">
              <p className="text-zinc-500 dark:text-zinc-400">Nenhum devocional postado ainda.</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 cursor-pointer font-medium" onClick={openNewPostModal}>Seja o primeiro a compartilhar!</p>
            </div>
          ) : (
            (Object.entries(groupedPosts) as [string, any[]][]).map(([groupName, groupPosts]) => (
              <div key={groupName} className="mb-8">
                {/* Separador de Tempo */}
                <div className="mb-5 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    {groupName}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent"></div>
                </div>

                <div className="flex flex-col gap-4">
                  {groupPosts.map((post: any) => {
                    const isLiked = post.likedBy?.includes(currentUser?.uid) || false
                    const isPrayed = post.prayedBy?.includes(currentUser?.uid) || false
                    const likesCount = post.likedBy?.length || 0
                    const canEditOrDelete = currentUser?.uid === post.authorId || currentUser?.role === 'admin'
                    
                    return (
                      <article id={`post-${post.id}`} key={post.id} className="rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-5 shadow-xl shadow-zinc-200/50 dark:shadow-2xl dark:shadow-black/10 transition hover:border-emerald-400/30 sm:p-6 duration-300">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarClasses(post.authorColor)} text-sm font-bold shadow-sm`}>
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
                                <button onClick={() => openEditModal(post)} className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors active:scale-90" title="Editar">
                                  <Edit2 className="size-4" />
                                </button>
                                <button onClick={() => handleDeletePost(post.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors active:scale-90" title="Apagar">
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
                              {/* Aplicação da Tipografia Serifada */}
                              <p className="font-serif text-sm italic text-zinc-700 dark:text-zinc-300 leading-relaxed">&quot;{post.verse}&quot;</p>
                              {post.reference && (
                                <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-500">{post.reference}</p>
                              )}
                            </div>
                          )}

                          {(() => {
                            const paginas = Array.isArray(post.content) ? post.content : [post.content]
                            const paginaAtual = paginasAtuais[post.id] || 0
                            const totalPaginas = paginas.length

                            return (
                              <div className="mt-4 overflow-hidden">
                                {/* Aplicação de Fonte Serifada e Animação no Carrossel */}
                                <p key={paginaAtual} className="animate-fade-slide font-serif text-sm leading-6 text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words line-clamp-3">
                                  {paginas[paginaAtual]}
                                </p>
                                
                                {totalPaginas > 1 && (
                                  <div className="carousel-controls mt-3 flex items-center justify-between border-t border-zinc-100 dark:border-white/[0.06] pt-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); mudarPagina(post.id, 'ant', totalPaginas) }}
                                      disabled={paginaAtual === 0}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30 transition-all active:scale-90"
                                    >
                                      <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    
                                    <span className="text-xs font-medium text-zinc-500">
                                      {paginaAtual + 1} de {totalPaginas}
                                    </span>
                                    
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); mudarPagina(post.id, 'prox', totalPaginas) }}
                                      disabled={paginaAtual === totalPaginas - 1}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30 transition-all active:scale-90"
                                    >
                                      <ChevronRight className="h-5 w-5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        
                        <div className="post-actions mt-6 flex items-center justify-between border-t border-zinc-100 dark:border-white/[0.06] pt-4">
                          <button 
                            onClick={() => setReadingPostId(post.id)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition hover:text-emerald-500 dark:hover:text-emerald-300"
                          >
                            Ler devocional <span aria-hidden="true">→</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleShare(post.id, post.title)}
                              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition font-medium bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-90"
                              title="Compartilhar"
                            >
                              <Share2 className="size-4" />
                            </button>
                            {/* Adição do active:scale-90 para Micro-interação de clique */}
                            <button 
                              onClick={() => toggleInteraction(post.id, 'likedBy', isLiked)}
                              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition-all duration-200 active:scale-90 font-medium ${isLiked ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-transparent dark:bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                            >
                              <Heart className={`size-4 ${isLiked ? 'animate-pulse' : ''}`} fill={isLiked ? 'currentColor' : 'none'} /> {likesCount}
                            </button>
                            <button 
                              onClick={() => toggleInteraction(post.id, 'prayedBy', isPrayed)}
                              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition-all duration-200 active:scale-90 font-medium ${isPrayed ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-transparent dark:bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                            >
                              {isPrayed ? <Check className="size-4" /> : <HandHeart className="size-4" />} Amém
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {hasMore && posts.length >= postLimit && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setIsLoadingMore(true)
                setPostLimit(prev => prev + 2) 
              }}
              disabled={isLoadingMore}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900 px-6 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  A carregar...
                </>
              ) : (
                'Carregar Mais'
              )}
            </button>
          </div>
        )}
        
        {!hasMore && posts.length > 0 && (
          <div className="mt-12 flex justify-center">
            <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              Chegou ao fim! Todos os devocionais foram carregados.
            </p>
          </div>
        )}
      </div>

      <button 
        onClick={openNewPostModal}
        className="fixed bottom-6 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-[0_0_28px_rgba(16,185,129,0.45)] transition hover:scale-105 hover:bg-emerald-400 active:scale-90 sm:right-8"
      >
        <PenLine className="size-6" />
      </button>

      {/* MODAL DE PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 p-4 backdrop-blur-sm transition-colors">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl transition-colors duration-300">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Seu Perfil</h2>
              <button onClick={() => setIsProfileModalOpen(false)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-white transition-colors active:scale-90">
                <X className="size-5" />
              </button>
            </div>
            {/* Restante do formulário de perfil inalterado... */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className={`flex size-24 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarClasses(selectedColor)} text-2xl font-bold shadow-lg transition-all duration-300`}>
                {getInitials(currentUser?.nome)}
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg text-zinc-900 dark:text-white">{currentUser?.nome}</p>
                <p className="text-sm text-zinc-500">{currentUser?.email}</p>
              </div>
            </div>
            <div className="mb-8">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Escolha a cor do seu avatar:</p>
              <div className="grid grid-cols-3 gap-3">
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`h-12 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center transition-all ${selectedColor === color.id ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950 scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'} active:scale-95`}
                    title={color.label}
                  >
                    {selectedColor === color.id && <Check className={`size-5 ${color.text}`} />}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-bold text-white dark:text-zinc-950 transition hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 active:scale-95"
            >
              {isUpdatingProfile ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 p-4 backdrop-blur-sm transition-colors">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl transition-colors duration-300">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{editingId ? 'Editar Reflexão' : 'Compartilhar Reflexão'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-white transition-colors active:scale-90">
                <X className="size-5" />
              </button>
            </div>
            {/* O formulário de criação mantém-se inalterado */}
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

              <div className="flex flex-col gap-4 mt-2">
                {formData.content.map((pageText, index) => (
                  <div key={index} className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Página {index + 1}
                      </label>
                      {formData.content.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeFormPage(index)} 
                          className="text-rose-500 hover:text-rose-600 text-xs flex items-center gap-1 font-medium transition-colors"
                        >
                          <Trash2 className="size-3"/> Remover
                        </button>
                      )}
                    </div>
                    <textarea
                      required
                      rows={4}
                      spellCheck={true}
                      placeholder={index === 0 ? "O que Deus tem falado ao seu coração hoje?" : "Continue a sua reflexão..."}
                      value={pageText}
                      onChange={(e) => updateFormPage(index, e.target.value)}
                      className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addFormPage}
                  className="flex items-center justify-center gap-2 py-3 mt-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors active:scale-95"
                >
                  <Plus className="size-4" /> Adicionar Página
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-bold text-white dark:text-zinc-950 transition hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 active:scale-95"
                style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)' }}
              >
                {isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Devocional' : 'Publicar Devocional')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE LEITURA COMPLETA COM CONTROLOS DE TAMANHO DA FONTE */}
      {readingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 p-4 backdrop-blur-sm transition-colors">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-10 shadow-2xl transition-colors duration-300">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarClasses(readingPost.authorColor)} text-sm font-bold shadow-sm`}>
                    {getInitials(readingPost.authorName)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{readingPost.authorName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatDate(readingPost.createdAt)}</p>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl leading-tight">{readingPost.title}</h2>
              </div>
              
              <button onClick={() => setReadingPostId(null)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-white transition-colors flex-shrink-0 active:scale-90">
                <X className="size-6" />
              </button>
            </div>

            {/* Painel de Controlo de Leitura (A- / A+) */}
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-2 w-fit border border-zinc-200 dark:border-zinc-800/50">
              <Type className="size-4 ml-2 text-zinc-400" />
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"></div>
              <button 
                onClick={() => setFontSize(prev => Math.max(14, prev - 2))}
                className="flex size-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition active:scale-90"
                title="Diminuir texto"
              >
                <Minus className="size-4" />
              </button>
              <span className="text-xs font-medium text-zinc-500 min-w-[20px] text-center">{fontSize}</span>
              <button 
                onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
                className="flex size-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition active:scale-90"
                title="Aumentar texto"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <div className="mt-2">
              {readingPost.verse && (
                <div className="mb-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 p-5 sm:p-6 border border-zinc-200 dark:border-zinc-800/50">
                  {/* Fonte Serifada no Versículo */}
                  <p className="font-serif italic text-zinc-700 dark:text-zinc-300 leading-relaxed" style={{ fontSize: `${fontSize + 2}px` }}>
                    &quot;{readingPost.verse}&quot;
                  </p>
                  {readingPost.reference && (
                    <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-500">{readingPost.reference}</p>
                  )}
                </div>
              )}

              {(() => {
                const paginas = Array.isArray(readingPost.content) ? readingPost.content : [readingPost.content]
                const paginaAtual = paginasAtuais[readingPost.id] || 0
                const totalPaginas = paginas.length

                return (
                  <div className="overflow-hidden">
                    {/* Fonte Serifada, Tamanho Dinâmico e Animação no Conteúdo Principal */}
                    <p 
                      key={paginaAtual} 
                      className="animate-fade-slide font-serif leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words min-h-[120px]"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {paginas[paginaAtual]}
                    </p>
                    
                    {totalPaginas > 1 && (
                      <div className="mt-8 flex items-center justify-between border-y border-zinc-100 dark:border-white/[0.06] py-4">
                        <button 
                          onClick={() => mudarPagina(readingPost.id, 'ant', totalPaginas)}
                          disabled={paginaAtual === 0}
                          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-30 transition-all active:scale-95"
                        >
                          <ChevronLeft className="h-4 w-4" /> Anterior
                        </button>
                        
                        <span className="text-sm font-medium text-zinc-500">
                          Página {paginaAtual + 1} de {totalPaginas}
                        </span>
                        
                        <button 
                          onClick={() => mudarPagina(readingPost.id, 'prox', totalPaginas)}
                          disabled={paginaAtual === totalPaginas - 1}
                          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-30 transition-all active:scale-95"
                        >
                          Próxima <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Micro-interações na Leitura Completa */}
            <div className="mt-8 flex flex-wrap items-center gap-2 pt-2">
              <button 
                onClick={() => toggleInteraction(readingPost.id, 'likedBy', readingPost.likedBy?.includes(currentUser?.uid))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 active:scale-90 font-medium ${readingPost.likedBy?.includes(currentUser?.uid) ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-800'}`}
              >
                <Heart className={`size-4 ${readingPost.likedBy?.includes(currentUser?.uid) ? 'animate-pulse' : ''}`} fill={readingPost.likedBy?.includes(currentUser?.uid) ? 'currentColor' : 'none'} /> Curtir ({readingPost.likedBy?.length || 0})
              </button>
              <button 
                onClick={() => toggleInteraction(readingPost.id, 'prayedBy', readingPost.prayedBy?.includes(currentUser?.uid))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 active:scale-90 font-medium ${readingPost.prayedBy?.includes(currentUser?.uid) ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-zinc-200 dark:border-zinc-800'}`}
              >
                {readingPost.prayedBy?.includes(currentUser?.uid) ? <Check className="size-4" /> : <HandHeart className="size-4" />} Amém
              </button>
              <div className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 ml-auto">
                <MessageCircle className="size-4" /> {comments.length}
              </div>
            </div>

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
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 transition hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 active:scale-95"
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
                      <span className={`flex size-8 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarClasses(comment.authorColor)} text-[10px] font-bold shadow-sm shrink-0`}>
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