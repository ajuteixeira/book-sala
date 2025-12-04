import React, { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

  // load saved matricula on mount
  React.useEffect(() => {
    const savedMatricula = localStorage.getItem('savedMatricula');
    if (savedMatricula) {
      setMatricula(savedMatricula);
      setRememberMe(true);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    // validate matricula: only numbers, 7-9 digits
    const matriculaRegex = /^\d{7,9}$/;
    if (!matriculaRegex.test(matricula)) {
      setError('Matrícula deve conter apenas números (7 a 9 dígitos)');
      return;
    }

    if (!password) {
      setError('Por favor, digite sua senha');
      return;
    }

    try {
      const res = await axios.post(API + '/auth/login', {
        matricula,
        password,
      });

      // save or remove matricula based on remember me checkbox
      if (rememberMe) {
        localStorage.setItem('savedMatricula', matricula);
      } else {
        localStorage.removeItem('savedMatricula');
      }

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      if (err.response) {
        // server responded with error
        setError(err.response.data?.error || 'Matrícula ou senha incorretos');
      } else if (err.request) {
        // request made but no response
        setError('Erro de conexão. Verifique sua internet ou tente novamente.');
      } else {
        // something else happened
        setError('Erro ao tentar fazer login. Tente novamente.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* title section */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-[#044cf4] mb-2">BookSala</h1>
          <p className="text-gray-600 text-lg">
            Agendamentos de salas da biblioteca UNIFOR
          </p>
        </div>

        {/* login form */}
        <form onSubmit={submit} className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Entrar</h2>
          {error && <div className="text-red-600 mb-4 text-sm">{error}</div>}
          <label className="block mb-2 text-gray-700 font-medium">
            Matrícula
          </label>
          <input
            value={matricula}
            onChange={(e) => {
              const value = e.target.value;
              // allow only numbers, max 9 digits
              if (value === '' || /^\d{1,9}$/.test(value)) {
                setMatricula(value);
                setError('');
              }
            }}
            className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#044cf4] focus:border-transparent"
            placeholder="Digite sua matrícula"
            maxLength="9"
          />
          <label className="block mb-2 text-gray-700 font-medium">Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#044cf4] focus:border-transparent"
            placeholder="Digite sua senha"
          />

          {/* remember me checkbox */}
          <div className="flex items-center mb-6">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-[#044cf4] border-gray-300 rounded focus:ring-[#044cf4]"
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
              Lembrar identificação de usuário
            </label>
          </div>

          <button className="w-full py-3 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded-lg font-semibold transition-colors">
            Entrar
          </button>
        </form>

        {/* forgot password section */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow-lg">
          <h3 className="font-semibold text-gray-800 mb-3">
            Esqueceu sua senha?
          </h3>
          <p className="text-gray-600 text-sm mb-2">
            Acesse a página do{' '}
            <span className="font-medium">Unifor Online</span> e clique em
            "Esqueceu sua senha?".
          </p>
          <p className="text-gray-600 text-sm">
            Por favor, espere <span className="font-medium">1 hora</span> antes
            de tentar acessar novamente.
          </p>
        </div>
      </div>
    </div>
  );
}
