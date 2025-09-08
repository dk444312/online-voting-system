
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const VoterRegistration: React.FC = () => {
  const [step, setStep] = useState<'verify' | 'create'>('verify');
  const [formData, setFormData] = useState({
    registrationNumber: '',
    fullName: '',
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState('Checking registration status...');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const checkRegistrationDeadline = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'registration_deadline')
          .single();

        if (error || !data || !data.value) {
          setIsRegistrationOpen(true);
          setDeadlineMessage('');
          return;
        }

        const deadline = new Date(data.value);
        if (new Date() < deadline) {
          setIsRegistrationOpen(true);
          setDeadlineMessage(`Registration is open until ${deadline.toLocaleString()}.`);
        } else {
          setIsRegistrationOpen(false);
          setDeadlineMessage(`Registration closed on ${deadline.toLocaleString()}.`);
        }
      } catch (err) {
        setIsRegistrationOpen(false);
        setDeadlineMessage('Could not verify registration deadline. Please try again later.');
      } finally {
        setPageLoading(false);
      }
    };

    checkRegistrationDeadline();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage(null);
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isRegistrationOpen) {
      setMessage({ type: 'error', text: 'Registration period has ended.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { registrationNumber, fullName } = formData;
    if (!registrationNumber || !fullName) {
        setMessage({ type: 'error', text: 'Registration number and full name are required.' });
        setLoading(false);
        return;
    }

    try {
        const { data: regData, error: regError } = await supabase
            .from('registrations')
            .select('id')
            .eq('registration_number', registrationNumber.trim())
            .ilike('student_name', `%${fullName.trim()}%`)
            .single();
        
        if (regError || !regData) {
            throw new Error("Invalid registration number or name. Please check your details and try again.");
        }

        const { data: voterData, error: voterError } = await supabase
            .from('voters')
            .select('id')
            .eq('registration_number', registrationNumber.trim())
            .single();

        if (voterError && voterError.code !== 'PGRST116') {
            throw voterError;
        }

        if (voterData) {
            throw new Error("This registration number has already been used to create an account.");
        }

        setStep('create');

    } catch (error: any) {
        setMessage({ type: 'error', text: error.message || 'An error occurred during verification.' });
    } finally {
        setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { registrationNumber, fullName, username, password } = formData;
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Username and password are required.' });
      setLoading(false);
      return;
    }

    try {
        const { data: existingUser, error: checkError } = await supabase
            .from('voters')
            .select('id')
            .eq('username', username.trim())
            .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        if (existingUser) {
            setMessage({ type: 'error', text: 'Username already taken. Please choose another one.' });
            setLoading(false);
            return;
        }

        const { error: insertError } = await supabase.from('voters').insert([
            {
                registration_number: registrationNumber.trim(),
                full_name: fullName.trim(),
                username: username.trim(),
                password: password,
                has_voted: false,
            },
        ]);

        if (insertError) throw insertError;

        setMessage({ type: 'success', text: 'Registration successful! You can now log in and vote.' });
        
        setTimeout(() => {
            setStep('verify');
            setFormData({ registrationNumber: '', fullName: '', username: '', password: ''});
            setMessage(null);
        }, 5000);

    } catch (error: any) {
        setMessage({ type: 'error', text: error.message || 'An error occurred during registration.' });
    } finally {
        setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
         <div className="flex flex-col items-center gap-4">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
            <p className="text-slate-600">{deadlineMessage}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-800 text-center mb-2">Voter Registration</h1>
        
        {!isRegistrationOpen && (
            <p className="text-center text-red-600 mb-6 bg-red-50 p-3 rounded-lg border border-red-200">{deadlineMessage}</p>
        )}
        {isRegistrationOpen && deadlineMessage && (
            <p className="text-center text-green-700 mb-6 bg-green-50 p-3 rounded-lg border border-green-200">{deadlineMessage}</p>
        )}

        {isRegistrationOpen ? (
            <div>
                <div className="flex justify-center items-center mb-6">
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'verify' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
                        <p className={`ml-2 font-semibold ${step === 'verify' ? 'text-blue-700' : 'text-gray-500'}`}>Verify</p>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
                        <p className={`ml-2 font-semibold ${step === 'create' ? 'text-blue-700' : 'text-gray-500'}`}>Create Account</p>
                    </div>
                </div>

                {step === 'verify' && (
                    <form onSubmit={handleVerify} className="space-y-4">
                        <p className="text-center text-gray-600">Enter your official details to begin.</p>
                        <input type="text" name="registrationNumber" placeholder="Registration Number" value={formData.registrationNumber} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center">
                            {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                            {loading ? 'Verifying...' : 'Verify & Continue'}
                        </button>
                    </form>
                )}

                {step === 'create' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                         <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                            <p className="text-sm text-green-800">Verified as:</p>
                            <p className="font-bold text-green-900">{formData.fullName}</p>
                            <p className="font-mono text-sm text-green-900">{formData.registrationNumber}</p>
                        </div>
                        <p className="text-center text-gray-600">Create your credentials for online voting.</p>
                        <input type="text" name="username" placeholder="Create a Username" value={formData.username} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} name="password" placeholder="Create a Password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 text-gray-500">
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        <div className="flex gap-2">
                             <button type="button" onClick={() => { setStep('verify'); setMessage(null); }} className="w-1/3 bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">Back</button>
                             <button type="submit" disabled={loading} className="w-2/3 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center">
                                {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                                {loading ? 'Registering...' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        ) : (
             <div className="text-center py-8">
                <i className="fas fa-times-circle text-5xl text-red-500 mb-4"></i>
                <p className="text-lg text-slate-700">Registration is now closed.</p>
             </div>
        )}
        
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
