import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

// --- Configuration ---
const IP_REGISTRATION_LIMIT = 1;

// --- Types ---
interface FormData {
    registrationNumber: string;
    fullName: string;
    username: string;
    password: string;
    confirmPassword: string;
    // NEW: Add passKey to FormData
    passKey: string; 
}

// Simplified Steps: 'initial' (verification) -> 'create' (account setup)
type Step = 'initial' | 'create'; 

// --- SVG Icons (No changes needed here) ---
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-black mx-auto" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const EyeOpenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg_Size" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeClosedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 013.558-5.175l-2.33-2.33m14.66 14.66l-2.33-2.33a10.05 10.05 0 003.558-5.175c-1.274 4.057-5.064 7-9.543 7a10.05 10.05 0 01-1.875-.2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 4.24A9.12 9.12 0 0112 4c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-2.16 3.19m-6.41-6.41L9 12a3 3 0 00-3-3m-3.19-2.16a9.12 9.12 0 00-3.19 2.16C3.732 7.943 7.523 5 12 5c1.478 0 2.89.39 4.16.99" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 01-3-3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
);

// --- Reusable Components (No changes needed here) ---
const GoogleModal: React.FC<{
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    show: boolean;
    footer?: React.ReactNode;
    isLarge?: boolean;
}> = ({ title, children, onClose, show, footer, isLarge = false }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
            <div className={`bg-white rounded-lg shadow-xl m-4 ${isLarge ? 'max-w-lg w-full' : 'max-w-md w-full'}`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-6">{children}</div>
                {footer && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

const FormInput: React.FC<{
    id: string;
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    required?: boolean;
    children?: React.ReactNode;
}> = ({ id, name, label, value, onChange, type = "text", required = true, children }) => (
    <div className="relative">
        <input
            id={id}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            className="block px-3.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-black peer"
            placeholder=" "
            required={required}
        />
        <label htmlFor={id} className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-black peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-2">
            {label}
        </label>
        {children && <div className="absolute inset-y-0 right-0 pr-3 flex items-center">{children}</div>}
    </div>
);

// --- Main Component ---
const VoterRegistration: React.FC = () => {

    const [step, setStep] = useState<Step>('initial');
    const [formData, setFormData] = useState<FormData>({
        registrationNumber: '',
        fullName: '',
        username: '',
        password: '',
        confirmPassword: '',
        passKey: '', 
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [clientIP, setClientIP] = useState<string | null>(null);
    const [ipLoading, setIpLoading] = useState(true);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [deadlineMessage, setDeadlineMessage] = useState('Checking registration status...');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [credentialsDownloaded, setCredentialsDownloaded] = useState(false);

    // --- Effects ---
    useEffect(() => {
        const fetchIP = async () => {
            setIpLoading(true);
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                setClientIP(data.ip);
            } catch {
                setMessage({ type: 'error', text: 'Could not determine IP.' });
            } finally {
                setIpLoading(false);
            }
        };
        fetchIP();
    }, []);

    useEffect(() => {
        const fetchRegistrationStatus = async () => {
            setPageLoading(true);
            try {
                const { data, error } = await supabase.from('settings').select('value').eq('key', 'registration_deadline').single();
                if (error && error.code !== 'PGRST116') throw error;

                if (data?.value) {
                    const deadlineDate = new Date(data.value);
                    if (new Date() < deadlineDate) {
                        setIsRegistrationOpen(true);
                        setDeadlineMessage('Registration is open.');
                    } else {
                        setIsRegistrationOpen(false);
                        setDeadlineMessage('Registration period has ended.');
                    }
                } else {
                    setIsRegistrationOpen(true);
                    setDeadlineMessage('Registration is open.');
                }
            } catch {
                setDeadlineMessage('Could not verify status.');
                setIsRegistrationOpen(false);
            } finally {
                setPageLoading(false);
            }
        };
        fetchRegistrationStatus();
    }, []);

    // --- Handlers ---
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Automatically convert passKey to uppercase for consistency
        const processedValue = name === 'passKey' ? value.toUpperCase() : value; 
        setFormData(prev => ({ ...prev, [name]: processedValue }));
        setMessage(null);
    };

    const handleInitialVerification = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        if (!isRegistrationOpen || !clientIP) return;

        setLoading(true);
        const { registrationNumber, fullName, passKey } = formData;

        try {
            // --- 1. Pass Key Validation (Retained internal logic) ---
            const keyPrefix = passKey.substring(0, 1);
            const keyNumber = parseInt(passKey.substring(1), 10);
            
            // Basic format check
            if (keyPrefix !== 'A' || isNaN(keyNumber)) {
                throw new Error("Invalid Pass Key format. Please check your key.");
            }
            
            // Range check (A1001 to A13000)
            if (keyNumber < 1001 || keyNumber > 13000) {
                throw new Error("Pass Key is invalid. Please check your key.");
            }
            
            // --- 2. Check Voter Existence and IP Limit ---
            const { data: voterData } = await supabase.from('voters').select('has_voted').eq('registration_number', registrationNumber.trim()).maybeSingle();
            if (voterData?.has_voted) throw new Error("Already voted.");
            if (voterData) throw new Error("Account exists. Please log in.");

            const { count: ipCount } = await supabase.from('voters').select('id', { count: 'exact' }).eq('registration_ip', clientIP);
            if (ipCount !== null && ipCount >= IP_REGISTRATION_LIMIT) {
                throw new Error(`Max ${IP_REGISTRATION_LIMIT} registration(s) per network.`);
            }
            
            // --- 3. Verify Registration Number and Name ---
            const { data: regData } = await supabase.from('registrations').select('id').eq('registration_number', registrationNumber.trim()).ilike('student_name', `%${fullName.trim()}%`).maybeSingle();
            if (!regData) throw new Error("Invalid registration number or name.");

            
            // Verification successful -> proceed directly to account creation
            setStep('create');
            setMessage({ type: 'success', text: 'Verification successful! Create your account.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Verification failed.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        if (formData.password !== formData.confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match.' });
        if (formData.password.length < 6) return setMessage({ type: 'error', text: 'Password must be 6+ characters.' });
        if (!agreedToTerms) return setMessage({ type: 'error', text: 'You must agree to the Terms.' });
        if (!clientIP) return setMessage({ type: 'error', text: 'IP missing.' });

        setLoading(true);
        try {
            const { data: existingUser } = await supabase.from('voters').select('id').eq('username', formData.username.trim()).maybeSingle();
            if (existingUser) throw new Error('Username taken.');

            const { count: ipCount } = await supabase.from('voters').select('id', { count: 'exact' }).eq('registration_ip', clientIP);
            if (ipCount !== null && ipCount >= IP_REGISTRATION_LIMIT) throw new Error('IP limit reached.');

            // Final Insertion
            const { error } = await supabase.from('voters').insert([{
                registration_number: formData.registrationNumber.trim(),
                full_name: formData.fullName.trim(),
                username: formData.username.trim(),
                password: formData.password,
                has_voted: false,
                registration_ip: clientIP,
                email: 'none_provided@local.host', 
            }]);
            if (error) throw error;

            setShowCredentialsModal(true);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Registration failed.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCredentials = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = 450, h = 250;
        canvas.width = w; canvas.height = h;

        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4);

        ctx.fillStyle = '#000'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('VOTING CREDENTIALS', w / 2, 50);
        ctx.font = '14px sans-serif'; ctx.fillStyle = '#555'; ctx.fillText('Keep secure. Do not share.', w / 2, 80);

        ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.font = '16px sans-serif';
        ctx.fillText('Username:', 60, 140); ctx.fillText('Password:', 60, 190);
        ctx.font = 'bold 20px monospace';
        ctx.fillText(formData.username, 180, 140); ctx.fillText(formData.password, 180, 190);

        const link = document.createElement('a');
        link.download = 'voting-credentials.png';
        link.href = canvas.toDataURL();
        link.click();
        setCredentialsDownloaded(true);
    };

    const handleConfirmAndRedirect = () => {
        setShowCredentialsModal(false);
        setMessage({ type: 'success', text: 'Redirecting...' });
        setTimeout(() => { window.location.href = 'https://campusvote-mpy1.onrender.com'; }, 1000);
    };

    // --- Render Loading ---
    if (pageLoading || ipLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
                    <p className="text-gray-600">{ipLoading ? 'Securing connection...' : deadlineMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md mx-auto bg-white border border-gray-300 rounded-xl shadow-sm p-6 md:p-8">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Voter Registration 🗳️</h1>
                    <p className="text-gray-500 mt-1">{deadlineMessage}</p>
                    {clientIP && <p className="text-xs text-gray-400 mt-1">IP: {clientIP}</p>}
                </div>

                {!isRegistrationOpen ? (
                    <div className="text-center py-8">
                        <p className="text-lg text-gray-800 font-semibold">Registration is closed.</p>
                    </div>
                ) : (
                    <div>
                        {/* Progress Bar */}
                        <div className="flex justify-between items-center mb-8 text-xs font-medium">
                            <span className={step === 'initial' ? 'text-black font-bold' : 'text-gray-500'}>1. Verification</span>
                            <div className="flex-1 h-px bg-gray-200 mx-2"></div>
                            <span className={step === 'create' ? 'text-black font-bold' : 'text-gray-500'}>2. Create Account</span>
                        </div>

                        {message && (
                            <div className={`mb-4 text-center p-3 rounded-lg border text-sm ${message.type === 'success' ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-red-100 border-red-300 text-red-900'}`}>
                                {message.text}
                            </div>
                        )}

                        {/* Step 1: Initial Verification with Pass Key */}
                        {step === 'initial' && (
                            <form onSubmit={handleInitialVerification} className="space-y-6">
                                <FormInput id="registrationNumber" name="registrationNumber" label="Registration Number" value={formData.registrationNumber} onChange={handleChange} />
                                <FormInput id="fullName" name="fullName" label="Full Name (as in SIMS)" value={formData.fullName} onChange={handleChange} />
                                {/* REMOVED RANGE TEXT FROM UI */}
                                <FormInput id="passKey" name="passKey" label="Pass Key (e.g., A1001)" value={formData.passKey} onChange={handleChange} /> 
                                <button type="submit" disabled={loading} className="w-full bg-black text-white font-semibold py-3 px-5 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center">
                                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Verify & Continue'}
                                </button>
                            </form>
                        )}

                        {/* Step 2: Create Account (No changes needed here) */}
                        {step === 'create' && (
                            <form onSubmit={handleRegister} className="space-y-6">
                                <div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg text-sm">
                                    <p>Verified Student: <span className="font-bold">{formData.fullName}</span></p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        You are creating an account for registration number: **{formData.registrationNumber}**
                                    </p>
                                </div>
                                <FormInput id="username" name="username" label="Create Username" value={formData.username} onChange={handleChange} />
                                <FormInput id="password" name="password" label="Create Password (min 6)" value={formData.password} onChange={handleChange} type={showPassword ? 'text' : 'password'}>
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-500 hover:text-black">
                                        {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                                    </button>
                                </FormInput>
                                <FormInput id="confirmPassword" name="confirmPassword" label="Confirm Password" value={formData.confirmPassword} onChange={handleChange} type={showConfirmPassword ? 'text' : 'password'}>
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-gray-500 hover:text-black">
                                        {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                                    </button>
                                </FormInput>
                                <div className="flex items-start space-x-3">
                                    <input type="checkbox" id="terms" checked={agreedToTerms} onChange={() => setAgreedToTerms(!agreedToTerms)} className="mt-1 h-4 w-4 text-black border-gray-300 rounded" />
                                    <label htmlFor="terms" className="text-sm text-gray-600">
                                        I agree to the <span className="text-black hover:underline cursor-pointer font-bold">Terms & Conditions</span>.
                                    </label>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setStep('initial')} className="w-1/3 bg-white text-black font-semibold py-3 px-4 border border-black rounded-lg hover:bg-gray-100">Back</button>
                                    <button type="submit" disabled={loading || !agreedToTerms} className="w-2/3 bg-black text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center">
                                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Register'}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="text-center mt-6">
                            <Link to="https://campusvote-mpy1.onrender.com" className="text-sm text-black hover:underline font-medium">
                                Already registered? Login here
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Credentials Modal */}
            <GoogleModal title="Save Your Credentials" show={showCredentialsModal} onClose={() => {}} isLarge={true} footer={
                <>
                    <button onClick={handleDownloadCredentials} className="bg-white text-black border border-black font-semibold py-2 px-4 rounded-md hover:bg-gray-100">Download PNG</button>
                    <button onClick={handleConfirmAndRedirect} disabled={!credentialsDownloaded} className="bg-black text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        Go to Portal
                    </button>
                </>
            }>
                <div className="space-y-4 text-center">
                    <CheckCircleIcon />
                    <p className="text-xl font-medium text-gray-800">Registration Complete!</p>
                    <p className="text-sm text-gray-600"><span className="font-bold">MUST</span> download credentials.</p>
                    <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg inline-block text-left space-y-3 w-full max-w-sm mx-auto">
                        <div><p className="text-xs text-gray-500">Username</p><span className="font-mono font-bold text-lg">{formData.username}</span></div>
                        <div><p className="text-xs text-gray-500">Password</p><span className="font-mono font-bold text-lg">{formData.password}</span></div>
                    </div>
                    <p className="text-red-600 font-bold text-sm">Save now or lose access.</p>
                </div>
            </GoogleModal>
        </div>
    );
};

export default VoterRegistration;
