import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login/>} />
        <Route path='/' element={<PrivateRoute><Dashboard/></PrivateRoute>} />
        <Route path='*' element={<Navigate to='/'/>} />
      </Routes>
    </BrowserRouter>
  );
}

function PrivateRoute({ children }){
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to='/login' />;
  return children;
}
