
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const VoterRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    registrationNumber: '',
    fullName: '',
    program: '',
    year: '',
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { registrationNumber, fullName, program, year, username, password } = formData;
    if (!registrationNumber || !fullName || !program || !year || !username || !password) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      setLoading(false);
      return;
    }

    try {
      // Check if registration number or username already exists
      const { data: existingVoters, error: checkError } = await supabase
        .from('voters')
        .select('id')
        .or(`registration_number.eq.${registrationNumber},username.eq.${username}`);

      if (checkError) throw checkError;

      if (existingVoters && existingVoters.length > 0) {
        setMessage({ type: 'error', text: 'Registration number or username already exists.' });
        setLoading(false);
        return;
      }

      // Insert new voter
      const { error: insertError } = await supabase.from('voters').insert([
        {
          registration_number: registrationNumber,
          full_name: fullName,
          program: program,
          year: year,
          username: username,
          password: password,
          has_voted: false,
        },
      ]);

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Registration successful! You can now participate in the online voting.' });
      setFormData({ registrationNumber: '', fullName: '', program: '', year: '', username: '', password: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred during registration.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-800 text-center mb-2">Voter Registration</h1>
        <p className="text-center text-slate-500 mb-8">Create your account to vote online.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" name="registrationNumber" placeholder="Registration Number" value={formData.registrationNumber} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" name="program" placeholder="Program of Study" value={formData.program} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" name="year" placeholder="Year of Study" value={formData.year} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <hr className="my-4"/>
          <input type="text" name="username" placeholder="Create a Username" value={formData.username} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} name="password" placeholder="Create a Password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 text-gray-500">
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center">
            {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        {message && (
          <div className={`mt-4 text-center p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <div className="text-center mt-6">
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">
            Are you an administrator? Login here.
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VoterRegistration;
