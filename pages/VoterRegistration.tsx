import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient'; // Supabase connection is kept

// Define types for form data - simplified
interface FormData {
    registrationNumber: string;
    fullName: string;
    username: string;
    password: string;
}

// Custom Modal Component (Theming is B&W for this component)
interface ModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    show: boolean;
    footer?: React.ReactNode;
    isLarge?: boolean;
}

const SimpleModal: React.FC<ModalProps> = ({ title, children, onClose, show, footer, isLarge = false }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
            <div 
                className={`bg-white text-black p-6 border border-black shadow-2xl rounded-lg transform transition-all 
                ${isLarge ? 'max-w-xl w-full' : 'max-w-md w-full'}`}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="flex justify-between items-center border-b pb-3 mb-4 border-black">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-black hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="max-h-96 overflow-y-auto text-sm">
                    {children}
                </div>
                {footer && (
                    <div className="pt-4 mt-4 border-t border-black flex justify-end">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};


const VoterRegistration: React.FC = () => {
    const [step, setStep] = useState<'verify' | 'create'>('verify');
    const [formData, setFormData] = useState<FormData>({
        registrationNumber: '',
        fullName: '',
        username: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // New state for Client IP
    const [clientIP, setClientIP] = useState<string | null>(null);
    const [ipLoading, setIpLoading] = useState(true);

    // New states for Modals and T&C
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // State for registration status and deadline
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [deadlineMessage, setDeadlineMessage] = useState('Checking registration status...');
    const [registrationDeadline, setRegistrationDeadline] = useState<Date | null>(null);

    // Effect to fetch the client's IP address
    useEffect(() => {
        const fetchIP = async () => {
            setIpLoading(true);
            try {
                // Use a reliable, simple third-party API to get the public IP
                // NOTE: This relies on an external service. For max security, IP should be captured server-side.
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                setClientIP(data.ip);
            } catch (error) {
                console.error('Failed to fetch client IP:', error);
                // In a real application, you might prevent registration if the IP can't be fetched
                setMessage({ type: 'error', text: 'Could not determine your IP address. Registration halted.' });
            } finally {
                setIpLoading(false);
            }
        };

        fetchIP();
    }, []);


    // Effect to fetch and manage registration status/deadline (kept as is)
    useEffect(() => {
        const fetchRegistrationStatus = async () => {
            setPageLoading(true);
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'registration_deadline')
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching registration deadline:', error);
                    setDeadlineMessage('Failed to load registration status.');
                    setIsRegistrationOpen(false);
                } else if (data && data.value) {
                    const deadlineDate = new Date(data.value);
                    setRegistrationDeadline(deadlineDate);

                    const now = new Date();
                    if (now < deadlineDate) {
                        setIsRegistrationOpen(true);
                        const diff = deadlineDate.getTime() - now.getTime();
                        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        setDeadlineMessage(`Registration is open! Deadline in ${days} day${days !== 1 ? 's' : ''}.`);
                    } else {
                        setIsRegistrationOpen(false);
                        setDeadlineMessage('Registration period has ended.');
                    }
                } else {
                    setIsRegistrationOpen(true);
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
        if (!clientIP) {
            setMessage({ type: 'error', text: 'Waiting to secure your connection IP. Please wait a moment.' });
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
            // --- CHECK 0: Check for Existing Physical Vote ---
            // If the registration number is found in the physical_votes table, block digital registration.
            const { data: physicalVoteData, error: physicalVoteError } = await supabase
                .from('physical_votes')
                .select('id')
                .eq('voter_reg_number', registrationNumber.trim()) // Assuming the column is voter_reg_number
                .single();
            
            if (physicalVoteError && physicalVoteError.code !== 'PGRST116') {
                throw physicalVoteError;
            }
            
            if (physicalVoteData) {
                throw new Error("This registration number has already been used to cast a digital ballot vote. online registration is prohibited.");
            }
            // --- END CHECK 0 ---


            // 1. PRIMARY CHECK: Check if an account already exists AND if a digital vote has been cast.
            const { data: voterData, error: voterError } = await supabase
                .from('voters')
                .select('id, has_voted') 
                .eq('registration_number', registrationNumber.trim())
                .single();

            if (voterError && voterError.code !== 'PGRST116') {
                throw voterError;
            }

            if (voterData) {
                // If account exists:
                // Check 1a: If they have voted digitally, BLOCK registration.
                if (voterData.has_voted === true) {
                    throw new Error("This registration number has already been used to **cast a digital vote**. Account changes and new registrations are prohibited.");
                }
                
                // Check 1b: If they are registered but have NOT voted, direct them to login.
                throw new Error("An account has already been created for this registration number. Please use your Username and Password to log in and vote.");
            }
            
            // 2. MASTER LIST VALIDATION: If no voter account exists yet, validate credentials against the master list (Registration Number + Full Name).
            const { data: regData, error: regError } = await supabase
                .from('registrations')
                .select('id')
                .eq('registration_number', registrationNumber.trim())
                .ilike('student_name', `%${fullName.trim()}%`)
                .single();
            
            if (regError || !regData) {
                throw new Error("Invalid registration number or full name. Please check your official details.");
            }
            
            // 3. IP DUPLICATION CHECK: Check if this IP address has already registered an account. (Retained for security)
            const { data: ipData, error: ipError } = await supabase
                .from('voters')
                .select('id')
                .eq('registration_ip', clientIP)
                .single();
                
            if (ipError && ipError.code !== 'PGRST116') {
                throw ipError;
            }
            
            if (ipData) {
                throw new Error(`An account has already been registered from this IP address: ${clientIP}. Please contact support.`);
            }

            // Success: Validated against master list, unique account/IP, and no vote cast. Proceed to account creation.
            setLoading(false);
            setShowInfoModal(true); 

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An error occurred during verification.' });
        } finally {
            setLoading(false);
        }
    };
    
    // New handler to proceed from info modal
    const handleProceedToCreate = () => {
        setShowInfoModal(false);
        setStep('create');
    }

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isRegistrationOpen) {
            setMessage({ type: 'error', text: 'Registration period has ended.' });
            return;
        }
        if (!agreedToTerms) {
            setMessage({ type: 'error', text: 'You must agree to the Terms and Conditions.' });
            return;
        }
        if (!clientIP) {
            setMessage({ type: 'error', text: 'IP address is missing. Please refresh and try again.' });
            return;
        }
        
        setLoading(true);
        setMessage(null);

        const { registrationNumber, fullName, username, password } = formData;
        // ... (existing form validation) ...

        try {
            // Check for existing username (as is)
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
            
            // Re-check IP just before final insert (optional but safe)
            const { data: ipData, error: ipError } = await supabase
                .from('voters')
                .select('id')
                .eq('registration_ip', clientIP)
                .single();
                
            if (ipError && ipError.code !== 'PGRST116') throw ipError;
            if (ipData) {
                throw new Error(`An account has already been registered from this IP address: ${clientIP}.`);
            }


            // Insert new voter - ADDING registration_ip COLUMN
            const { error: insertError } = await supabase.from('voters').insert([
                {
                    registration_number: registrationNumber.trim(),
                    full_name: fullName.trim(),
                    username: username.trim(),
                    password: password, // In a real app, hash this password on the server-side before storing!
                    has_voted: false,
                    registration_ip: clientIP, // <--- NEW: Store the IP address
                },
            ]);

            if (insertError) throw insertError;

            // Success: Show confirmation modal instead of direct message/redirect
            setShowConfirmModal(true);
            setMessage(null); // Clear previous message
            
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An error occurred during registration.' });
        } finally {
            setLoading(false);
        }
    };
    
    // Handler for Confirm Modal (as is)
    const handleConfirmAndRedirect = () => {
        setShowConfirmModal(false);
        // Redirect to the voting portal
        setMessage({ type: 'success', text: 'Credentials confirmed! Redirecting to the voting portal...' });
        setTimeout(() => {
            window.location.href = 'https://campusvote-mpy1.onrender.com';
        }, 1000);
    }

    // Fallback loading screen (Updated with B&W theme)
    if (pageLoading || ipLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    {/* Black spinner */}
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div> 
                    <p className="text-black">{ipLoading ? 'Securing client IP address...' : deadlineMessage}</p>
                </div>
            </div>
        );
    }

    // Main Render (Rest of the component remains the same)
    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white text-black border border-black rounded-lg shadow-xl p-8">
                <h1 className="text-3xl font-bold text-center mb-2">Voter Registration</h1>
                
                {/* Display Deadline Status (Updated to B&W where possible) */}
                <div className={`text-center p-3 rounded-lg mb-6 border border-black 
                    ${isRegistrationOpen ? 'bg-gray-100' : 'bg-gray-200 text-red-700'}`
                }>
                    <p className="font-medium">{deadlineMessage}</p>
                    {registrationDeadline && isRegistrationOpen && (
                        <p className="text-sm">Ends: {registrationDeadline.toLocaleDateString()} {registrationDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    {clientIP && <p className="text-xs text-gray-500 mt-1">Your IP: {clientIP}</p>}
                </div>

                {/* Conditional rendering for the registration steps */}
                {!isRegistrationOpen && (
                    <div className="text-center py-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-black mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-lg">Registration is now closed.</p>
                    </div>
                )}

                {isRegistrationOpen && (
                    <div>
                        {/* Step Indicator (Updated to B&W theme) */}
                        <div className="flex justify-center items-center mb-6">
                            <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border border-black 
                                    ${step === 'verify' ? 'bg-black text-white' : 'bg-white text-black'}`}>1</div>
                                <p className={`ml-2 font-semibold ${step === 'verify' ? 'text-black' : 'text-gray-500'}`}>Verify</p>
                            </div>
                            <div className="flex-1 h-0.5 bg-gray-400 mx-4"></div>
                            <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border border-black 
                                    ${step === 'create' ? 'bg-black text-white' : 'bg-white text-black'}`}>2</div>
                                <p className={`ml-2 font-semibold ${step === 'create' ? 'text-black' : 'text-gray-500'}`}>Create Account</p>
                            </div>
                        </div>

                        {/* Step 1: Verification */}
                        {step === 'verify' && (
                            <form onSubmit={handleVerify} className="space-y-4">
                                <p className="text-center text-gray-600">Enter your official details to begin.</p>
                                <input type="text" name="registrationNumber" placeholder="Registration Number" value={formData.registrationNumber} onChange={handleChange} className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required />
                                <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required />
                                <button type="submit" disabled={loading || ipLoading} className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center">
                                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : null}
                                    {loading ? 'Verifying...' : 'Verify & Continue'}
                                </button>
                            </form>
                        )}

                        {/* Step 2: Create Credentials */}
                        {step === 'create' && (
                            <form onSubmit={handleRegister} className="space-y-4">
                                    <div className="p-3 bg-gray-100 border border-black rounded-lg text-center">
                                        <p className="text-sm">Verified as:</p>
                                        <p className="font-bold">{formData.fullName}</p>
                                        <p className="font-mono text-sm">{formData.registrationNumber}</p>
                                    </div>
                                <p className="text-center text-gray-600">Create your secure credentials for the **voting portal**.</p>
                                <input type="text" name="username" placeholder="Create a Username" value={formData.username} onChange={handleChange} className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required />
                                <div className="relative">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        name="password" 
                                        placeholder="Create a Password (min 6 chars)" 
                                        value={formData.password} 
                                        onChange={handleChange} 
                                        className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black" 
                                        required 
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 text-gray-700 hover:text-black">
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.41-6.41a2 2 0 1 0-2.83-2.83"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        )}
                                    </button>
                                </div>
                                {/* Terms and Conditions Checkbox */}
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        id="terms" 
                                        checked={agreedToTerms} 
                                        onChange={() => setAgreedToTerms(!agreedToTerms)} 
                                        className="w-4 h-4 text-black bg-white border-black rounded focus:ring-black"
                                    />
                                    <label htmlFor="terms" className="text-sm font-medium">
                                        I agree to the <span className="underline cursor-pointer font-bold" onClick={() => alert("Replace this with your actual terms and conditions modal/link.")}>Terms & Conditions</span>
                                    </label>
                                </div>

                                <div className="flex gap-2">
                                        <button type="button" onClick={() => { setStep('verify'); setMessage(null); setFormData(prev => ({ ...prev, username: '', password: '' })); setAgreedToTerms(false); }} className="w-1/3 bg-gray-200 text-black font-bold py-3 px-4 border border-black rounded-lg hover:bg-gray-300 transition-colors">Back</button>
                                        <button type="submit" disabled={loading || !agreedToTerms} className="w-2/3 bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center">
                                            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : null}
                                            {loading ? 'Registering...' : 'Complete Registration'}
                                        </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
                
                {message && (
                    <div className={`mt-4 text-center p-3 rounded-lg border border-black ${message.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {message.text}
                    </div>
                )}
                
                <div className="text-center mt-6">
                    <Link to="https://campusvote-mpy1.onrender.com" className="text-sm text-black hover:underline font-semibold">
                    Already registered? Login here.
                    </Link>
                </div>
            </div>
            
            {/* 1. Pre-Creation Info Modal (as is) */}
            <SimpleModal 
                title="VOTING PORTAL CREDENTIALS" 
                show={showInfoModal} 
                onClose={() => {setShowInfoModal(false); setStep('verify');}}
            >
                {/* ... (Modal content as is) ... */}
                <div className="space-y-4">
                    <p className="text-lg font-semibold text-center">Your verification was successful</p>
                    <p className="text-center">You are about to create your <div className="font-bold">Username </div>and <div className="font-bold">Password </div>specifically for the **Online Voting Portal**.</p>
                    <blockquote className="p-3 border-l-4 border-black bg-gray-100 italic">
                        <p>Do not confuse these with your official Registration Number or Full Name. These credentials will be used for logging in to cast your vote**.</p>
                    </blockquote>
                    <p className="text-center font-bold">Please agree to the terms and conditions in the next step to create your credentials and participate in the elections.</p>
                </div>
                <button 
                    onClick={handleProceedToCreate} 
                    className="w-full mt-4 bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    I Understand, Proceed to Create Credentials
                </button>
            </SimpleModal>

            {/* 2. Post-Creation Confirmation Modal (as is) */}
            <SimpleModal 
                title="REGISTRATION COMPLETE" 
                show={showConfirmModal} 
                onClose={() => { /* Prevent closing on click outside */ }}
                isLarge={true}
                footer={
                    <button 
                        onClick={handleConfirmAndRedirect} 
                        className="bg-black text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Confirm & Go to Voting Portal
                    </button>
                }
            >
                {/* ... (Modal content as is) ... */}
                <div className="space-y-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-black mx-auto" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xl font-bold">Success! Your account is ready.</p>
                    <p className="text-sm">Please WRITE DOWN and CONFIRM the credentials you just created. You will need these to log in and cast your vote.</p>

                    <div className="bg-gray-100 p-4 border border-black rounded-lg inline-block text-left">
                        <p className="font-semibold mb-1 underline">Your New Voting Credentials:</p>
                        <p><strong>Registration Number (Verified):</strong> <span className="font-mono">{formData.registrationNumber}</span></p>
                        <p><strong>Full Name (Verified):</strong> {formData.fullName}</p>
                        <hr className="my-2 border-gray-400"/>
                        <p><strong>Voting Username:</strong> <span className="font-mono font-bold text-lg text-black">{formData.username}</span></p>
                        <p><strong>Voting Password:</strong> <span className="font-mono font-bold text-lg text-black">{formData.password}</span></p>
                    </div>
                    <p className="text-red-600 font-bold">KEEP THESE SECURE!</p>
                </div>
            </SimpleModal>
        </div>
    );
};

export default VoterRegistration;
