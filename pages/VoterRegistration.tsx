import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Keeping Link for internal navigation
import { supabase } from '../services/supabaseClient'; // Ensure this path is correct

// Define types for form data - simplified
interface FormData {
  registrationNumber: string;
  fullName: string;
  username: string;
  password: string;
}

const VoterRegistration: React.FC = () => {
  const [step, setStep] = useState<'verify' | 'create'>('verify');
  const [formData, setFormData] = useState<FormData>({ // Use FormData interface
    registrationNumber: '',
    fullName: '',
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // State for registration status and deadline
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false); // Default to false
  const [pageLoading, setPageLoading] = useState(true);
  const [deadlineMessage, setDeadlineMessage] = useState('Checking registration status...');
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | null>(null); // To store the actual deadline date

  // Effect to fetch and manage registration status/deadline
  useEffect(() => {
    const fetchRegistrationStatus = async () => {
      setPageLoading(true);
      try {
        // Fetch the registration_deadline from the 'settings' table
        const { data, error } = await supabase
          .from('settings') // Assuming your table is named 'settings'
          .select('value')
          .eq('key', 'registration_deadline')
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no row found, which is okay
            console.error('Error fetching registration deadline:', error);
            setDeadlineMessage('Failed to load registration status.');
            setIsRegistrationOpen(false);
        } else if (data && data.value) {
            const deadlineDate = new Date(data.value);
            setRegistrationDeadline(deadlineDate); // Store the actual deadline date

            const now = new Date();
            if (now < deadlineDate) {
                setIsRegistrationOpen(true);
                // Calculate remaining time for a more dynamic message
                const diff = deadlineDate.getTime() - now.getTime();
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                setDeadlineMessage(`Registration is open! Deadline in ${days} day${days !== 1 ? 's' : ''}.`);
            } else {
                setIsRegistrationOpen(false);
                setDeadlineMessage('Registration period has ended.');
            }
        } else {
            // No deadline setting found or deadline not configured in the DB
            // You might want to default to closed or open based on your app's policy
            setIsRegistrationOpen(true); // Default to open if no deadline is explicitly set
            setDeadlineMessage('Registration is currently open (no specific deadline configured).');
        }

      } catch (err: any) {
        console.error('Unexpected error:', err);
        setDeadlineMessage('An unexpected error occurred while checking registration status.');
        setIsRegistrationOpen(false);
      } finally {
        setPageLoading(false);
      }
    };

    fetchRegistrationStatus();
  }, []); // Empty dependency array means this runs once on mount

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
    if (!isRegistrationOpen) {
      setMessage({ type: 'error', text: 'Registration period has ended.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { registrationNumber, fullName, username, password } = formData;
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Username and password are required.' });
      setLoading(false);
      return;
    }
    if (password.length < 6) { // Basic password strength check
        setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
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
                password: password, // In a real app, hash this password on the server-side before storing!
                has_voted: false,
            },
        ]);

        if (insertError) throw insertError;

        setMessage({ type: 'success', text: 'Registration successful! Redirecting you to the voting portal...' });
        
        // 👇 The redirect logic using the provided external URL
        setTimeout(() => {
            window.location.href = 'https://campusvote-mpy1.onrender.com';
        }, 2000);

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div> {/* Generic spinner */}
            <p className="text-slate-600">{deadlineMessage}</p>
         </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-800 text-center mb-2">Voter Registration</h1>
        
        {/* Display Deadline Status */}
        <div className={`text-center p-3 rounded-lg mb-6 
            ${isRegistrationOpen ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`
        }>
            <p className="font-medium">{deadlineMessage}</p>
            {registrationDeadline && isRegistrationOpen && (
                <p className="text-sm">Ends: {registrationDeadline.toLocaleDateString()} {registrationDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            )}
        </div>

        {/* Conditional rendering for the registration steps */}
        {!isRegistrationOpen && (
             <div className="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-lg text-slate-700">Registration is now closed.</p>
             </div>
        )}

        {isRegistrationOpen && (
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
                            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : null} {/* Generic spinner */}
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
                            <input 
                              type={showPassword ? "text" : "password"} 
                              name="password" 
                              placeholder="Create a Password" 
                              value={formData.password} 
                              onChange={handleChange} 
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                              required 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 text-gray-500">
                                {/* Generic eye icons */}
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414L5.586 7H3a1 1 0 000 2h3.586l-2.293 2.293a1 1 0 001.414 1.414l2.293-2.293L10 13.414l1.293 1.293a1 1 0 001.414-1.414L11.414 11l2.293-2.293a1 1 0 00-1.414-1.414L10 9.586l-2.293-2.293L3.707 2.293zM16 11a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div className="flex gap-2">
                             <button type="button" onClick={() => { setStep('verify'); setMessage(null); setFormData(prev => ({ ...prev, username: '', password: '' })); }} className="w-1/3 bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">Back</button>
                             <button type="submit" disabled={loading} className="w-2/3 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center">
                                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : null} {/* Generic spinner */}
                                {loading ? 'Registering...' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        )}
        
        {message && (
          <div className={`mt-4 text-center p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
        {/* Updated the link to use React Router's <Link> for internal navigation */}
        <div className="text-center mt-6">
           <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Already registered? Login here.
           </Link>
        </div>
      </div>
    </div>
  );
};

export default VoterRegistration;
