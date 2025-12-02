import React, { useState } from 'react';
import axios from 'axios';

export default function Login(){
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(API + '/auth/login', { matricula, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">BookSala - Entrar</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <label className="block mb-2">Matrícula</label>
        <input value={matricula} onChange={e=>setMatricula(e.target.value)} className="w-full p-2 border mb-3" />
        <label className="block mb-2">Senha</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full p-2 border mb-4" />
        <button className="w-full py-2 bg-blue-600 text-white rounded">Entrar</button>
      </form>
    </div>
  );
}
