import { NextResponse } from 'next/server'
// Importações modulares (Padrão novo do Firebase Admin v12+)
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// Inicializa o Firebase Admin de forma segura no servidor
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // O replace garante que as quebras de linha da chave privada funcionem no Vercel
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  } catch (error) {
    console.error('Erro ao inicializar o Firebase Admin', error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, authorName } = body

    const db = getFirestore()
    
    // Procura na base de dados todos os utilizadores que ativaram o sininho
    const usersSnapshot = await db.collection('usuarios')
      .where('wantsNotifications', '==', true)
      .get()

    const tokens: string[] = []
    
    // O tipo "any" resolve o erro 7006 do TypeScript
    usersSnapshot.forEach((doc: any) => {
      const userData = doc.data()
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken)
      }
    })

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'Nenhum token encontrado.' }, { status: 200 })
    }

    // Prepara a mensagem que vai aparecer no telemóvel
    const message = {
      notification: {
        title: `Novo devocional de ${authorName} 🙏`,
        body: title,
      },
      tokens: tokens,
    }

    // Dispara a notificação em massa para todos os telemóveis
    const response = await getMessaging().sendEachForMulticast(message)
    
    return NextResponse.json({ success: true, enviados: response.successCount })
  } catch (error) {
    console.error('Erro ao enviar notificação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}