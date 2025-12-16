import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { supabase } from './lib/supabase'

// Inicializar usuário administrador no Supabase Auth
const initializeAdminUser = async () => {
  try {
    const adminEmail = 'admin@brfintech.ia.br';
    const adminPassword = '1414';

    // Verificar se o usuário já existe
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (existingUser) {
      console.log('Usuário administrador já existe:', adminEmail);
      return;
    }

    // Tentar fazer signup (criará o usuário no Supabase Auth)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        data: {
          name: 'Administrador',
        },
      },
    });

    if (signUpError) {
      // Se o erro for que o usuário já existe, tentar fazer login
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
        console.log('Usuário já existe no Supabase Auth, tentando fazer login...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });
        if (signInError) {
          console.error('Erro ao fazer login do admin:', signInError);
        }
      } else {
        console.error('Erro ao criar usuário administrador:', signUpError);
      }
      return;
    }

    if (authData.user) {
      // Criar registro na tabela users
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          name: 'Administrador',
          email: adminEmail,
          role: 'admin',
        });

      if (userError) {
        console.error('Erro ao criar registro do usuário na tabela:', userError);
      } else {
        console.log('Usuário administrador criado com sucesso:', adminEmail);
      }
    }
  } catch (error) {
    console.error('Erro ao inicializar usuário administrador:', error);
  }
};

// Inicializar usuário administrador
initializeAdminUser();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

