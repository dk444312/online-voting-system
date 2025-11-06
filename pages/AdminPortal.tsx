import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';
import type { Director, Candidate, Voter, Admin, Registration } from '../types';

type AdminView = 'DASHBOARD' | 'DEADLINE' | 'CANDIDATES' | 'VOTERS' | 'REGISTRATIONS' | 'ADMINS' | 'RESULTS' | 'STATISTICS' | 'SECURITY';

// Local types
interface Position {
    id: number;
    name: string;
}

// Helper component for Password Field
const PasswordField: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; id: string; }> = ({ value, onChange, placeholder, id }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                id={id}
                type={show ? "text" : "password"}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="w-full p-4 pr-12 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-slate-600">
                <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
        </div>
    );
};

const Page: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
        <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">{title}</h2>
        {children}
    </div>
);

// --- CHART COMPONENTS ---

interface TurnoutChartProps {
  voted: number;
  total: number;
}
const VoterTurnoutChart: React.FC<TurnoutChartProps> = ({ voted, total }) => {
  if (total === 0) return <div className="h-[300px] flex items-center justify-center text-center text-gray-500">No voters registered yet.</div>;
  
  const pending = total - voted;
  const data = [
    { name: 'Voted', value: voted },
    { name: 'Pending', value: pending },
  ];
  const COLORS = ['#475569', '#cbd5e1']; // Slate-600, Slate-300

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={100}
          fill="#8884d8"
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value} voters`} contentStyle={{ backgroundColor: 'rgb(30 41 59 / 0.9)', borderColor: '#475569', color: '#e2e8f0', borderRadius: '0.75rem' }}/>
        <Legend iconType="circle" wrapperStyle={{color: '#e2e8f0'}}/>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-white">
          {total > 0 ? `${((voted / total) * 100).toFixed(1)}%` : '0%'}
        </text>
        <text x="50%" y="50%" dy={25} textAnchor="middle" className="text-sm fill-slate-400">
          Turnout
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

interface VoterTypeChartProps {
  voters: Voter[];
}
const VoterTypeChart: React.FC<VoterTypeChartProps> = ({ voters }) => {
  if (voters.length === 0) return <div className="h-[300px] flex items-center justify-center text-center text-gray-500">No voter data available.</div>;

  const physicalVotersCount = voters.filter(v => /[0-9]/.test(v.username)).length;
  const onlineVotersCount = voters.length - physicalVotersCount;
  
  const data = [
      { name: 'Online', value: onlineVotersCount },
      { name: 'Physical', value: physicalVotersCount },
  ];
  const COLORS = ['#334155', '#64748b']; // Slate-700, Slate-500

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={90}
          fill="#8884d8"
          dataKey="value"
          labelLine={false}
          // FIX: Using `any` to bypass a complex typing issue with recharts library's PieLabelRenderProps.
          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
            if (percent == null || percent === 0) return null;
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return (
              <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-semibold">
                {`${(percent * 100).toFixed(0)}%`}
              </text>
            );
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value} voters`}/>
        <Legend iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
};

interface CandidatesChartProps {
  candidates: Candidate[];
}
const CandidatesPerPositionChart: React.FC<CandidatesChartProps> = ({ candidates }) => {
  if (candidates.length === 0) return <div className="h-[300px] flex items-center justify-center text-center text-gray-500">No candidates added yet.</div>;
  
  const positionCounts = candidates.reduce((acc: Record<string, number>, candidate) => {
    const pos = candidate.position || "Unspecified";
    acc[pos] = (acc[pos] || 0) + 1;
    return acc;
  }, {});

  const data = Object.keys(positionCounts).map(position => ({
    name: position,
    Candidates: positionCounts[position],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip cursor={{fill: 'rgba(241, 245, 249, 0.5)'}} />
        <Legend iconType="circle" />
        <Bar dataKey="Candidates" fill="#475569" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface VoterTypeBreakdownProps {
    voters: Voter[];
}
const VoterTypeBreakdown: React.FC<VoterTypeBreakdownProps> = ({ voters }) => {
    if (voters.length === 0) {
        return <div className="text-center text-gray-500 py-8">No voter data available.</div>;
    }

    const physicalVotersCount = voters.filter(v => /[0-9]/.test(v.username)).length;
    const onlineVotersCount = voters.length - physicalVotersCount;
    const totalVoters = voters.length;
    const onlinePercentage = totalVoters > 0 ? (onlineVotersCount / totalVoters) * 100 : 0;
    const physicalPercentage = totalVoters > 0 ? (physicalVotersCount / totalVoters) * 100 : 0;

    return (
        <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-lg border border-slate-700 h-full">
            <h3 className="text-xl font-semibold mb-4 text-center text-slate-300">Voter DNA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                    <i className="fas fa-desktop text-3xl text-slate-300 mb-2"></i>
                    <p className="text-lg font-semibold text-slate-300">Online Voters</p>
                    <p className="text-4xl font-bold text-white">{onlineVotersCount}</p>
                    <p className="text-slate-300 font-semibold">{onlinePercentage.toFixed(1)}%</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                    <i className="fas fa-walking text-3xl text-slate-300 mb-2"></i>
                    <p className="text-lg font-semibold text-slate-300">Physical Voters</p>
                    <p className="text-4xl font-bold text-white">{physicalVotersCount}</p>
                    <p className="text-slate-300 font-semibold">{physicalPercentage.toFixed(1)}%</p>
                </div>
            </div>
            <div className="flex w-full h-3 mt-4 rounded-full overflow-hidden bg-slate-600">
                <div style={{ width: `${onlinePercentage}%` }} className="bg-slate-300 transition-all duration-500"></div>
                <div style={{ width: `${physicalPercentage}%` }} className="bg-slate-500 transition-all duration-500"></div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: string; title: string; value: string | number; color: string; className?: string; }> = ({ icon, title, value, color, className }) => (
    <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 flex items-center gap-4 transition-all hover:border-slate-600 hover:shadow-lg hover:-translate-y-1 ${className || ''}`}>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
            <i className={`fas ${icon} text-xl text-white`}></i>
        </div>
        <div>
            <p className="text-sm text-gray-400 font-medium">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
        </div>
    </div>
);

// --- NEW STATISTICS COMPONENTS ---

const rankColors: { [key: number]: string } = {
    1: 'border-amber-400 text-amber-400',
    2: 'border-slate-400 text-slate-400',
    3: 'border-amber-600 text-amber-600',
};

const CandidateStatCard: React.FC<{ candidate: any; isUpdated: boolean; positionTotalVotes: number; }> = ({ candidate, isUpdated, positionTotalVotes }) => {
    const { rank, isTied, votes, name, photo_url } = candidate;
    const rankClass = rankColors[rank] || 'border-slate-600 text-slate-500';
    const percentage = positionTotalVotes > 0 ? (votes / positionTotalVotes) * 100 : 0;

    return (
        <div className={`
            bg-slate-800/50 border-2 rounded-2xl p-4 flex items-center gap-4 transition-all duration-500 relative overflow-hidden
            ${isUpdated ? 'border-white shadow-lg shadow-white/20 animate-glow' : rank === 1 ? 'border-amber-400/50' : 'border-slate-700'}
            ${isTied ? 'shadow-lg shadow-slate-500/40' : ''}
        `}>
            {isUpdated && <div className="absolute top-2 right-2 text-xs font-bold text-white animate-fade-in-out opacity-0" style={{animationDuration: '3s', animationFillMode: 'forwards'}}>+ VOTE</div>}
            
            {isTied && (
                <div className="absolute top-2 left-3 text-xs font-bold text-slate-300 bg-slate-900/50 px-2 py-0.5 rounded-full">
                    VOTES TIED
                </div>
            )}

            <div className={`w-12 h-12 text-3xl font-bold flex items-center justify-center flex-shrink-0 ${rankClass}`}>
                {rank === 1 ? <i className="fas fa-trophy"></i> : rank}
            </div>
            <img src={photo_url} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-600"/>
            <div className="flex-grow">
                <p className="font-bold text-lg text-white">{name}</p>
                <div className="w-full bg-slate-700 rounded-full h-3 mt-1 overflow-hidden">
                    <div className="bg-slate-400 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                </div>
            </div>
            <div className={`text-right flex-shrink-0 w-24 ml-2 transition-transform duration-500 ${isUpdated ? 'scale-110' : ''}`}>
                <p className={`text-4xl font-black ${isUpdated ? 'text-white animate-number-bump' : 'text-white'}`}>{votes}</p>
                <p className="text-slate-400 font-semibold">{percentage.toFixed(1)}%</p>
            </div>
        </div>
    );
};


const PositionRaceView: React.FC<{ positionResult: any; updatedCandidates: Set<string>; }> = ({ positionResult, updatedCandidates }) => {
    return (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <h3 className="text-3xl font-bold text-white mb-1">{positionResult.position}</h3>
            <p className="text-slate-400 mb-6">Total Votes: <span className="font-bold text-slate-300">{positionResult.totalVotes}</span></p>
            <div className="space-y-4">
                {positionResult.candidates.map((c: any) => (
                    <CandidateStatCard 
                        key={c.id} 
                        candidate={c}
                        isUpdated={updatedCandidates.has(c.id)}
                        positionTotalVotes={positionResult.totalVotes}
                    />
                ))}
            </div>
        </div>
    );
};


const AdminPortal: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<Director | null>(null);
    const [view, setView] = useState<AdminView>('DASHBOARD');
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    // Data State
    const [dashboardStats, setDashboardStats] = useState({ candidates: 0, voters: 0, votes: 0 });
    const [deadline, setDeadline] = useState('');
    const [deadlineRaw, setDeadlineRaw] = useState('');
    const [registrationDeadline, setRegistrationDeadline] = useState('');
    const [registrationDeadlineRaw, setRegistrationDeadlineRaw] = useState('');
    const [timeRemaining, setTimeRemaining] = useState('');
    const [electionStatus, setElectionStatus] = useState<'Preparing' | 'Active' | 'Ended'>('Preparing');
    const [isRegistrationActive, setIsRegistrationActive] = useState(true);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [voters, setVoters] = useState<Voter[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [results, setResults] = useState<any[]>([]);
    
    // Form States
    const [candidateName, setCandidateName] = useState('');
    const [candidatePosition, setCandidatePosition] = useState('');
    const [candidatePhoto, setCandidatePhoto] = useState<File | null>(null);
    const [newPositionName, setNewPositionName] = useState('');
    const [bulkCandidateData, setBulkCandidateData] = useState('');
    const [newAdminUsername, setNewAdminUsername] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [deadlineInput, setDeadlineInput] = useState('');
    const [registrationDeadlineInput, setRegistrationDeadlineInput] = useState('');
    const [formMessage, setFormMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [regNumber, setRegNumber] = useState('');
    const [studentName, setStudentName] = useState('');
    const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
    const [registrationSearchTerm, setRegistrationSearchTerm] = useState('');
    const [bulkRegData, setBulkRegData] = useState('');


    // Voter management state
    const [voterSearchTerm, setVoterSearchTerm] = useState('');
    const [voterSortKey, setVoterSortKey] = useState<'username' | 'created_at' | 'has_voted' | 'voter_type'>('created_at');
    const [voterSortOrder, setVoterSortOrder] = useState<'asc' | 'desc'>('desc');
    const [voterStatusFilter, setVoterStatusFilter] = useState<'all' | 'voted' | 'pending'>('all');
    const [voterTypeFilter, setVoterTypeFilter] = useState<'all' | 'physical' | 'online'>('all');

    // Statistics View State
    const [recentVoters, setRecentVoters] = useState<{ registration_number: string; full_name: string; }[]>([]);

    // Security View State
    const [securityData, setSecurityData] = useState<{
        duplicateRegistrations: { registration_number: string; voters: Voter[] }[];
        sessionTimings: (Voter & { vote_time?: string; duration?: number })[];
    }>({ duplicateRegistrations: [], sessionTimings: [] });
    const [sessionFilter, setSessionFilter] = useState<'all' | 'voted' | 'fast'>('all');
    const [sessionSearch, setSessionSearch] = useState('');
    
    // Live Tracking & Animation State
    const [isLive, setIsLive] = useState(false);
    const [newVoteToast, setNewVoteToast] = useState<string | null>(null);
    const [flashVotesCard, setFlashVotesCard] = useState(false);
    const [updatedCandidates, setUpdatedCandidates] = useState<Set<string>>(new Set());
    const prevResultsRef = useRef<any[]>();


    // --- AUTHENTICATION ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setLoginError('');
        try {
            const { data, error } = await supabase
                .from('directors')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();
            if (error || !data) throw new Error('Invalid username or password');
            setCurrentUser(data);
        } catch (err: any) {
            setLoginError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    // --- DATA FETCHING ---
    const fetchDashboardStats = useCallback(async () => {
        const { count: candidatesCount } = await supabase.from('candidates').select('*', { count: 'exact', head: true });
        const { count: votersCount } = await supabase.from('voters').select('*', { count: 'exact', head: true });
        const { count: votesCastCount } = await supabase.from('voters').select('*', { count: 'exact', head: true }).eq('has_voted', true);
        setDashboardStats({ candidates: candidatesCount || 0, voters: votersCount || 0, votes: votesCastCount || 0 });
    }, []);

    const fetchDeadline = useCallback(async () => {
        const { data } = await supabase.from('settings').select('value').eq('key', 'voting_deadline').single();
        if (data && data.value) {
            const deadlineDate = new Date(data.value);
            setDeadline(deadlineDate.toLocaleString());
            setDeadlineRaw(data.value);
            setDeadlineInput(data.value.substring(0, 16));
        } else {
            setDeadline('Not set');
            setDeadlineRaw('');
            setDeadlineInput('');
        }
    }, []);

    const fetchRegistrationDeadline = useCallback(async () => {
        const { data } = await supabase.from('settings').select('value').eq('key', 'registration_deadline').single();
        if (data && data.value) {
            const deadlineDate = new Date(data.value);
            setRegistrationDeadline(deadlineDate.toLocaleString());
            setRegistrationDeadlineRaw(data.value);
            setRegistrationDeadlineInput(data.value.substring(0, 16));
        } else {
            setRegistrationDeadline('Not set');
            setRegistrationDeadlineRaw('');
            setRegistrationDeadlineInput('');
        }
    }, []);
    
    const fetchCandidates = useCallback(async () => {
        const { data } = await supabase.from('candidates').select('*').order('created_at');
        setCandidates(data || []);
    }, []);

    const fetchPositions = useCallback(async () => {
        const { data } = await supabase.from('positions').select('*').order('name');
        setPositions(data || []);
    }, []);

   const fetchVoters = useCallback(async () => {
    let allVoters: Voter[] = [];
    const BATCH_SIZE = 1000;
    let start = 0;

    while (true) {
        const { data, error } = await supabase
            .from('voters')
            .select('*')
            .range(start, start + BATCH_SIZE - 1)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) break;

        allVoters.push(...data);
        start += BATCH_SIZE;
    }

    console.log('Total voters loaded:', allVoters.length); // Should show real number
    setVoters(allVoters);
}, []);
    const fetchRegistrations = useCallback(async () => {
    let allRegistrations: Registration[] = [];
    const BATCH_SIZE = 1000;
    let start = 0;

    while (true) {
        const { data, error, count } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: false })
            .range(start, start + BATCH_SIZE - 1)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching registrations:', error);
            break;
        }

        if (!data || data.length === 0) break;

        allRegistrations = allRegistrations.concat(data);
        start += BATCH_SIZE;

        // Optional: stop early if we know total
        if (count && allRegistrations.length >= count) break;
    }

    console.log('Total registrations loaded:', allRegistrations.length); // Should be 6139+
    setRegistrations(allRegistrations);
}, []);
    const fetchAdmins = useCallback(async () => {
        const { data } = await supabase.from('directors').select('*').order('created_at');
        setAdmins(data || []);
    }, []);

    const getFinalVoteCounts = useCallback(async () => {
    // --- 1. Load ALL candidates (batch) ---
    let allCandidates: Candidate[] = [];
    let start = 0;
    const BATCH_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .range(start, start + BATCH_SIZE - 1);

        if (error || !data || data.length === 0) break;
        allCandidates.push(...data);
        start += BATCH_SIZE;
    }

    if (allCandidates.length === 0) {
        return { candidates: [], voteCounts: new Map(), totalVotes: 0 };
    }

    // --- 2. Build candidate ID map: (position_name → id) ---
    const candidateIdMap = new Map<string, string>();
    allCandidates.forEach(c => {
        const key = `${c.position}_${c.name}`;
        candidateIdMap.set(key, c.id);
    });

    // --- 3. Load ALL online votes (batch) ---
    const voteCounts = new Map<string, number>(
        allCandidates.map(c => [c.id, 0])
    );

    start = 0;
    while (true) {
        const { data, error } = await supabase
            .from('votes')
            .select('candidate_id')
            .range(start, start + BATCH_SIZE - 1);

        if (error || !data || data.length === 0) break;

        data.forEach(vote => {
            if (vote.candidate_id) {
                const id = vote.candidate_id as string;
                voteCounts.set(id, (voteCounts.get(id) || 0) + 1);
            }
        });
        start += BATCH_SIZE;
    }

    // --- 4. Load ALL physical votes (usually small, but safe) ---
    const { data: physicalVotes } = await supabase
        .from('physical_votes')
        .select('votes');

    physicalVotes?.forEach(pVote => {
        if (pVote.votes) {
            try {
                const voteData: any = typeof pVote.votes === 'string'
                    ? JSON.parse(pVote.votes)
                    : pVote.votes;

                for (const position in voteData) {
                    const candidateName = voteData[position];
                    const key = `${position}_${candidateName}`;
                    const candidateId = candidateIdMap.get(key);
                    if (candidateId) {
                        voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
                    }
                }
            } catch (e) {
                console.error('Error parsing physical vote:', e);
            }
        }
    });

    // --- 5. Calculate total votes ---
    const totalVotes = Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0);

    return {
        candidates: allCandidates,
        voteCounts,
        totalVotes,
    };
}, []);

    const fetchResults = useCallback(async () => {
        const { candidates, voteCounts } = await getFinalVoteCounts();
        if (candidates.length === 0) {
            setResults([]);
            return;
        }

        const typedCandidates = candidates as Candidate[];
        const positions = [...new Set(typedCandidates.map(c => c.position))];
        const formattedResults = positions.map(position => {
            const candidatesForPosition = typedCandidates.filter(c => c.position === position);
            const totalVotesForPosition = candidatesForPosition.reduce((sum, c) => sum + (voteCounts.get(c.id) || 0), 0);

            const sortedCandidates = candidatesForPosition.map(c => {
                const votes = voteCounts.get(c.id) || 0;
                return {
                    ...c,
                    votes,
                    percentage: totalVotesForPosition > 0 ? ((votes / totalVotesForPosition) * 100).toFixed(1) : "0",
                };
            }).sort((a, b) => b.votes - a.votes);

            let lastVotes = -1;
            let currentRank = 0;
            const rankedCandidates = sortedCandidates.map((c, index) => {
                if (c.votes !== lastVotes) {
                    currentRank = index + 1;
                    lastVotes = c.votes;
                }
                return { ...c, rank: currentRank };
            });

            const finalCandidates = rankedCandidates.map(c => {
                const isTied = rankedCandidates.filter(other => other.votes === c.votes).length > 1 && c.votes > 0;
                return { ...c, isTied };
            });

            return {
                position,
                totalVotes: totalVotesForPosition,
                candidates: finalCandidates,
            };
        });
        setResults(formattedResults);
    }, [getFinalVoteCounts]);
    
    const fetchRecentVoters = useCallback(async () => {
    const { data: votesData } = await supabase
        .from('votes')
        .select('voter_id, created_at')
        .order('created_at', { ascending: false })
        .limit(7); // still only 7

    if (!votesData?.length) {
        setRecentVoters([]);
        return;
    }

    const voterIds = votesData.map(v => v.voter_id);
    let allVoters: any[] = [];
    let start = 0;
    const BATCH = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('voters')
            .select('id, registration_number, full_name')
            .in('id', voterIds)
            .range(start, start + BATCH - 1);
        if (error || !data || data.length === 0) break;
        allVoters.push(...data);
        start += BATCH;
    }

    const voterMap = new Map(allVoters.map(v => [v.id, v]));
    const sorted = votesData
        .map(v => voterMap.get(v.voter_id))
        .filter(Boolean) as any[];
    setRecentVoters(sorted);
}, []);
    const fetchSecurityData = useCallback(async () => {
        // 1. Fetch all voters and online votes
        const { data: votersData, error: votersError } = await supabase.from('voters').select('*').order('created_at');
        const { data: votesData, error: votesError } = await supabase.from('votes').select('voter_id, created_at');

        if (votersError || votesError) {
            console.error("Error fetching security data:", votersError || votesError);
            return;
        }

        // 2. Analyze for duplicate registration numbers
        const registrationMap = new Map<string, Voter[]>();
        votersData?.forEach(voter => {
            if (voter.registration_number) {
                if (!registrationMap.has(voter.registration_number)) {
                    registrationMap.set(voter.registration_number, []);
                }
                registrationMap.get(voter.registration_number)!.push(voter);
            }
        });

        const duplicateRegistrations = Array.from(registrationMap.entries())
            .filter(([_, votersList]) => votersList.length > 1)
            .map(([registration_number, voters]) => ({ registration_number, voters }));

        // 3. Analyze session timings for online voters
        const voteTimeMap = new Map<string, string>();
        votesData?.forEach(vote => {
            voteTimeMap.set(vote.voter_id, vote.created_at);
        });

        const sessionTimings = votersData?.map(voter => {
            const voteTime = voteTimeMap.get(voter.id);
            let duration: number | undefined = undefined;
            if (voteTime) {
                const regTime = new Date(voter.created_at).getTime();
                const vTime = new Date(voteTime).getTime();
                duration = Math.round((vTime - regTime) / 1000); // duration in seconds
            }
            return {
                ...voter,
                vote_time: voteTime,
                duration: duration,
            };
        }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setSecurityData({ duplicateRegistrations, sessionTimings: sessionTimings || [] });
    }, []);

    const loadAllData = useCallback(async () => {
        await Promise.all([fetchDashboardStats(), fetchDeadline(), fetchRegistrationDeadline(), fetchCandidates(), fetchPositions(), fetchVoters(), fetchRegistrations(), fetchAdmins(), fetchResults(), fetchRecentVoters(), fetchSecurityData()]);
    }, [fetchDashboardStats, fetchDeadline, fetchRegistrationDeadline, fetchCandidates, fetchPositions, fetchVoters, fetchRegistrations, fetchAdmins, fetchResults, fetchRecentVoters, fetchSecurityData]);

    useEffect(() => {
        if (currentUser) {
            loadAllData();
        }
    }, [currentUser, loadAllData]);

    // Supabase real-time subscription
    useEffect(() => {
        if (!currentUser) return;

        const handleNewVote = (payload: any) => {
            console.log('New vote received!', payload);
            loadAllData(); // Refresh all data
            setNewVoteToast('A new vote has been registered!');
            
            setFlashVotesCard(true);
            setTimeout(() => setFlashVotesCard(false), 2000); // Duration of the flash animation
            
            setTimeout(() => setNewVoteToast(null), 5000); // Hide toast after 5 seconds
        };

        const channel = supabase
            .channel('public-db-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, handleNewVote)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'physical_votes' }, handleNewVote)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setIsLive(true);
                    console.log('Connected to real-time channel!');
                } else {
                    setIsLive(false);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser, loadAllData]);
    
    // Auto-refresh for statistics view
    useEffect(() => {
        if (view === 'STATISTICS' && electionStatus === 'Active') {
            const intervalId = setInterval(() => {
                loadAllData();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(intervalId);
        }
    }, [view, loadAllData, electionStatus]);

    // This effect detects changes in vote counts to trigger animations
    useEffect(() => {
        if (view === 'STATISTICS' && prevResultsRef.current && prevResultsRef.current.length > 0) {
            const updates = new Set<string>();
            const prevVoteMap = new Map<string, number>();
            prevResultsRef.current.forEach(pos => {
                pos.candidates.forEach((c: any) => {
                    prevVoteMap.set(c.id, c.votes);
                });
            });

            results.forEach(pos => {
                pos.candidates.forEach((c: any) => {
                    const prevVotes = prevVoteMap.get(c.id);
                    if (prevVotes !== undefined && c.votes > prevVotes) {
                        updates.add(c.id);
                    }
                });
            });

            if (updates.size > 0) {
                setUpdatedCandidates(updates);
                const timer = setTimeout(() => {
                    setUpdatedCandidates(new Set());
                }, 3000); // Animation highlight duration
                return () => clearTimeout(timer);
            }
        }
        prevResultsRef.current = results;
    }, [results, view]);


    useEffect(() => {
        const calculateTimeRemaining = () => {
            if (!deadlineRaw) {
                setElectionStatus('Preparing');
                setTimeRemaining('--');
                return;
            }
            const deadlineDate = new Date(deadlineRaw);
            const now = new Date();
            const diff = deadlineDate.getTime() - now.getTime();

            if (diff <= 0) {
                setElectionStatus('Ended');
                setTimeRemaining('Election has ended');
                return;
            }
            
            setElectionStatus('Active');
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            let remainingString = '';
            if (days > 0) remainingString += `${days}d `;
            if (hours > 0) remainingString += `${hours}h `;
            remainingString += `${minutes}m`;
            setTimeRemaining(remainingString.trim());
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 60000);
        return () => clearInterval(interval);
    }, [deadlineRaw]);

    useEffect(() => {
        if (!registrationDeadlineRaw) {
            setIsRegistrationActive(true); 
            return;
        }
        const deadlineDate = new Date(registrationDeadlineRaw);
        const now = new Date();
        setIsRegistrationActive(deadlineDate.getTime() > now.getTime());
    }, [registrationDeadlineRaw]);
    
    // --- ACTIONS ---

    const handleSetDeadline = async () => {
        setLoading(true);
        setFormMessage(null);
        try {
            if(!deadlineInput) throw new Error("Please select a valid date and time.");
            await supabase.from('settings').upsert({ key: 'voting_deadline', value: deadlineInput });
            setFormMessage({type: 'success', text: 'Voting deadline updated successfully.'});
            fetchDeadline();
        } catch (error: any) {
            setFormMessage({type: 'error', text: error.message});
        } finally {
            setLoading(false);
        }
    };
    
    const handleSetRegistrationDeadline = async () => {
        setLoading(true);
        setFormMessage(null);
        try {
            if(!registrationDeadlineInput) throw new Error("Please select a valid date and time.");
            await supabase.from('settings').upsert({ key: 'registration_deadline', value: registrationDeadlineInput });
            setFormMessage({type: 'success', text: 'Registration deadline updated successfully.'});
            fetchRegistrationDeadline();
        } catch (error: any) {
            setFormMessage({type: 'error', text: error.message});
        } finally {
            setLoading(false);
        }
    };

    const handleResetElections = async () => {
        if (window.confirm("Are you sure you want to reset all election data? This action cannot be undone.")) {
            setLoading(true);
            try {
                await supabase.from('votes').delete().neq('id', '0');
                await supabase.from('physical_votes').delete().neq('id', '0');
                await supabase.from('candidates').delete().neq('id', '0');
                await supabase.from('positions').delete().neq('id', '0');
                await supabase.from('voters').delete().neq('id', '0');
                await supabase.from('settings').delete().eq('key', 'voting_deadline');
                await supabase.from('settings').delete().eq('key', 'registration_deadline');
                alert('Election data has been reset.');
                loadAllData();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            } finally {
                setLoading(false);
            }
        }
    };
    
    const handleAddPosition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPositionName.trim()) {
            setFormMessage({ type: 'error', text: 'Position name cannot be empty.' });
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            const { error } = await supabase.from('positions').insert({ name: newPositionName.trim() });
            if (error) throw error;
            setFormMessage({ type: 'success', text: `Position "${newPositionName}" added.` });
            setNewPositionName('');
            fetchPositions();
        } catch (error: any) {
            if (error.code === '23505') {
                setFormMessage({ type: 'error', text: 'This position already exists.' });
            } else {
                setFormMessage({ type: 'error', text: error.message });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePosition = async (positionId: number, positionName: string) => {
        if (window.confirm(`Are you sure you want to delete the position "${positionName}"? This will also delete all candidates running for this position.`)) {
            setLoading(true);
            setFormMessage(null);
            try {
                // We must delete candidates first due to foreign key constraints
                await supabase.from('candidates').delete().eq('position', positionName);
                await supabase.from('positions').delete().eq('id', positionId);
                setFormMessage({ type: 'success', text: `Position "${positionName}" and its candidates deleted.` });
                fetchPositions();
                fetchCandidates();
            } catch (error: any) {
                setFormMessage({ type: 'error', text: error.message });
            } finally {
                setLoading(false);
            }
        }
    };
    
    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!candidateName || !candidatePosition || !candidatePhoto) {
            setFormMessage({type: 'error', text: 'All fields are required.'});
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            const fileName = `${Date.now()}_${candidatePhoto.name}`;
            const { error: uploadError } = await supabase.storage.from('candidate_photos').upload(fileName, candidatePhoto);
            if(uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('candidate_photos').getPublicUrl(fileName);
            
            const positionName = positions.find(p => p.id === parseInt(candidatePosition))?.name;
            if (!positionName) throw new Error("Selected position not found.");
            
            const { error: insertError } = await supabase.from('candidates').insert([{ name: candidateName, position: positionName, photo_url: publicUrl }]);
            if(insertError) throw insertError;

            setFormMessage({type: 'success', text: 'Candidate added.'});
            setCandidateName('');
            setCandidatePosition('');
            setCandidatePhoto(null);
            (document.getElementById('candidate-photo') as HTMLInputElement).value = "";
            fetchCandidates();
            fetchDashboardStats();
        } catch (error: any) {
            setFormMessage({type: 'error', text: error.message});
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAddCandidates = async () => {
        if (!bulkCandidateData.trim()) {
            setFormMessage({ type: 'error', text: 'Bulk data field is empty.' });
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            const lines = bulkCandidateData.trim().split(/\r?\n/);
            const positionNameMap = new Map(positions.map(p => [p.name.toLowerCase(), p.name]));
            
            const newCandidates = lines.map(line => {
                const parts = line.split(',');
                if (parts.length < 2) return null;
                const name = parts[0].trim();
                const positionInput = parts.slice(1).join(',').trim();
                const positionName = positionNameMap.get(positionInput.toLowerCase());

                if (!name || !positionName) return null;
                return { name, position: positionName, photo_url: 'https://via.placeholder.com/150' }; // Using a placeholder photo
            }).filter((item): item is { name: string; position: string; photo_url: string; } => item !== null);
            
            if (newCandidates.length === 0) {
                throw new Error("No valid data found. Ensure format is: CANDIDATE_NAME,POSITION_NAME and that the position exists.");
            }

            const { error } = await supabase.from('candidates').insert(newCandidates);
            if (error) throw error;
            
            setFormMessage({ type: 'success', text: `${newCandidates.length} candidates added successfully.` });
            setBulkCandidateData('');
            fetchCandidates();
            fetchDashboardStats();
        } catch (error: any) {
            setFormMessage({ type: 'error', text: `Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCandidate = async (id: string) => {
        if (window.confirm("Delete this candidate? This will also remove their votes.")) {
            await supabase.from('votes').delete().eq('candidate_id', id);
            const { error } = await supabase.from('candidates').delete().eq('id', id);
            if (error) {
                alert(`Error: ${error.message}`);
            } else {
                fetchCandidates();
                fetchDashboardStats();
            }
        }
    };

    const handleDeleteVoter = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this voter?")) {
            const { error } = await supabase.from('voters').delete().eq('id', id);
            if(error) {
                alert(`Error: ${error.message}`);
            } else {
                fetchVoters();
                fetchDashboardStats();
            }
        }
    };

    const handleAddOrUpdateRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regNumber || !studentName) {
            setFormMessage({ type: 'error', text: 'Registration number and student name are required.' });
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            let error;
            if (editingRegistration) {
                ({ error } = await supabase.from('registrations').update({ registration_number: regNumber.trim(), student_name: studentName.trim() }).eq('id', editingRegistration.id));
            } else {
                ({ error } = await supabase.from('registrations').insert([{ registration_number: regNumber.trim(), student_name: studentName.trim() }]));
            }
            if (error) throw error;
            
            setFormMessage({ type: 'success', text: `Registration ${editingRegistration ? 'updated' : 'added'} successfully.` });
            setRegNumber('');
            setStudentName('');
            setEditingRegistration(null);
            fetchRegistrations();
        } catch (error: any) {
            if (error.code === '23505') {
                setFormMessage({ type: 'error', text: 'This registration number already exists.' });
            } else {
                setFormMessage({ type: 'error', text: error.message });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEditRegistration = (reg: Registration) => {
        setEditingRegistration(reg);
        setRegNumber(reg.registration_number);
        setStudentName(reg.student_name);
        window.scrollTo(0, 0);
    };
    
    const handleCancelEdit = () => {
        setEditingRegistration(null);
        setRegNumber('');
        setStudentName('');
        setFormMessage(null);
    };

    const handleDeleteRegistration = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this registration entry?")) {
            const { error } = await supabase.from('registrations').delete().eq('id', id);
            if (error) {
                setFormMessage({ type: 'error', text: error.message });
            } else {
                setFormMessage({ type: 'success', text: 'Registration deleted.' });
                fetchRegistrations();
            }
        }
    };
    
    const handleBulkAddRegistrations = async () => {
        if (!bulkRegData.trim()) {
            setFormMessage({ type: 'error', text: 'Bulk data field is empty.' });
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            const lines = bulkRegData.trim().split(/\r?\n/);
            const newRegistrations = lines.map(line => {
                const parts = line.split(',');
                if (parts.length < 2) return null;
                const registration_number = parts[0].trim();
                const student_name = parts.slice(1).join(',').trim();
                if (!registration_number || !student_name) return null;
                return { registration_number, student_name };
            }).filter((item): item is { registration_number: string; student_name: string; } => item !== null);

            if (newRegistrations.length === 0) {
                throw new Error("No valid data found. Ensure format is: REGISTRATION_NUMBER,STUDENT_NAME");
            }

            const { error } = await supabase.from('registrations').insert(newRegistrations);

            if (error) {
                if (error.code === '23505' || error.message.includes('duplicate key')) {
                    throw new Error('Bulk import failed. One or more registration numbers already exist in the provided list or in the database. Please remove duplicates and try again.');
                }
                throw error;
            }

            setFormMessage({ type: 'success', text: `${newRegistrations.length} registrations added successfully.` });
            setBulkRegData('');
            fetchRegistrations();
        } catch (error: any) {
            setFormMessage({ type: 'error', text: `Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminUsername || !newAdminPassword) {
            setFormMessage({type: 'error', text: 'Username and password are required.'});
            return;
        }
        setLoading(true);
        setFormMessage(null);
        try {
            const { data: existing } = await supabase.from('directors').select('id').eq('username', newAdminUsername).maybeSingle();
            if(existing) throw new Error('Admin username already exists.');

            const { error } = await supabase.from('directors').insert([{ username: newAdminUsername, password: newAdminPassword }]);
            if (error) throw error;

            setFormMessage({type: 'success', text: 'Admin added successfully.'});
            setNewAdminUsername('');
            setNewAdminPassword('');
            fetchAdmins();
        } catch (error: any) {
            setFormMessage({type: 'error', text: error.message});
        } finally {
            setLoading(false);
        }
    };

    const handlePostResults = async () => {
        if (window.confirm("Are you sure you want to post the final results? This will save the final results and cannot be undone.")) {
            setLoading(true);
            try {
                const { candidates, voteCounts } = await getFinalVoteCounts();
                if (candidates.length === 0) throw new Error("No candidates to post results for.");

                const typedCandidates = candidates as Candidate[];
                const positions = [...new Set(typedCandidates.map(c => c.position))];
                const finalResults: { [key: string]: any[] } = {};
                
                positions.forEach(position => {
                    const candidatesForPosition = typedCandidates.filter(c => c.position === position);
                    const totalVotesForPosition = candidatesForPosition.reduce((sum, c) => sum + (voteCounts.get(c.id) || 0), 0);
                    
                    finalResults[position] = candidatesForPosition.map(candidate => {
                        const votes = voteCounts.get(candidate.id) || 0;
                        const percentage = totalVotesForPosition > 0 ? (votes / totalVotesForPosition) * 100 : 0;
                        return { id: candidate.id, name: candidate.name, votes: votes, percentage: parseFloat(percentage.toFixed(1)) };
                    });
                });

                const { error } = await supabase.from('official_results').insert({ results: finalResults });
                if (error) throw error;
                alert('Results posted successfully!');
            } catch (error: any) {
                alert('Error posting results: ' + error.message);
            } finally {
                setLoading(false);
            }
        }
    };
    

    // --- RENDER LOGIC ---
    const filteredAndSortedVoters = voters
    .filter(voter => {
        if (voterTypeFilter === 'all') return true;
        const isPhysical = /[0-9]/.test(voter.username);
        if (voterTypeFilter === 'physical') return isPhysical;
        if (voterTypeFilter === 'online') return !isPhysical;
        return true;
    })
    .filter(voter => {
        if (voterStatusFilter === 'voted') return voter.has_voted;
        if (voterStatusFilter === 'pending') return !voter.has_voted;
        return true;
    })
    .filter(voter => 
        voter.username.toLowerCase().includes(voterSearchTerm.toLowerCase()) ||
        (voter.full_name && voter.full_name.toLowerCase().includes(voterSearchTerm.toLowerCase())) ||
        (voter.registration_number && voter.registration_number.toLowerCase().includes(voterSearchTerm.toLowerCase()))
    )
    .sort((a, b) => {
        let comparison = 0;
        if (voterSortKey === 'voter_type') {
            const typeA = /[0-9]/.test(a.username) ? 'Physical' : 'Online';
            const typeB = /[0-9]/.test(b.username) ? 'Physical' : 'Online';
            comparison = typeA.localeCompare(typeB);
        } else {
            const key = voterSortKey as 'username' | 'created_at' | 'has_voted';
            const valA = a[key];
            const valB = b[key];

            if (valA > valB) {
                comparison = 1;
            } else if (valA < valB) {
                comparison = -1;
            }
        }

        return voterSortOrder === 'asc' ? comparison : -comparison;
    });

    const renderView = () => {
        switch (view) {
            case 'DASHBOARD': return (
                <Page title="Election Dashboard">
                    <div className="bg-gradient-to-r from-slate-50 to-gray-100 p-6 rounded-xl mb-8 border-2 border-slate-200">
                        <h3 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-3"><i className="fas fa-info-circle text-slate-500"></i>Election Status</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          <p><strong>Voting Status:</strong> <span className={`font-bold px-3 py-1 rounded-full text-sm bg-slate-200 text-slate-800`}>{electionStatus}</span></p>
                          <p><strong>Registration Status:</strong> <span className={`font-bold px-3 py-1 rounded-full text-sm bg-slate-200 text-slate-800`}>{isRegistrationActive ? 'Open' : 'Closed'}</span></p>
                          <p><strong>Voting Deadline:</strong> {deadline}</p>
                          <p><strong>Registration Deadline:</strong> {registrationDeadline}</p>
                          <p><strong>Time Remaining:</strong> {timeRemaining}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg text-center">
                            <i className="fas fa-users text-4xl mb-2"></i><h4 className="font-bold text-lg">Candidates</h4><p className="text-4xl font-bold">{dashboardStats.candidates}</p>
                        </div>
                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg text-center">
                            <i className="fas fa-user-check text-4xl mb-2"></i><h4 className="font-bold text-lg">Registered Voters</h4><p className="text-4xl font-bold">{dashboardStats.voters}</p>
                        </div>
                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg text-center">
                            <i className="fas fa-vote-yea text-4xl mb-2"></i><h4 className="font-bold text-lg">Votes Cast</h4>
                            <p className="text-4xl font-bold">{dashboardStats.votes}</p>
                            {dashboardStats.voters > 0 && (
                                <p className="text-sm opacity-80 mt-1">
                                    ({((dashboardStats.votes / dashboardStats.voters) * 100).toFixed(1)}% turnout)
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                            <h3 className="text-xl font-semibold text-slate-800 mb-4 text-center">Voter Turnout</h3>
                            <VoterTurnoutChart voted={dashboardStats.votes} total={dashboardStats.voters} />
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                            <h3 className="text-xl font-semibold text-slate-800 mb-4 text-center">Voter Types</h3>
                            <VoterTypeChart voters={voters} />
                        </div>
                    </div>
                    <div className="mt-6 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <h3 className="text-xl font-semibold text-slate-800 mb-4 text-center">Candidates per Position</h3>
                        <CandidatesPerPositionChart candidates={candidates} />
                    </div>

                    <button onClick={loadAllData} className="mt-8 w-full max-w-sm mx-auto flex justify-center items-center gap-2 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors"><i className="fas fa-sync-alt"></i>Refresh Dashboard</button>
                </Page>
            );
            case 'DEADLINE': return (
                <Page title="Manage Deadlines">
                     <div className="space-y-10">
                        <div className="p-6 bg-gray-50 rounded-lg border">
                           <h3 className="text-xl font-semibold mb-4 text-center">Set Voter Registration Deadline</h3>
                           <div className="max-w-md mx-auto text-center">
                               <input type="datetime-local" value={registrationDeadlineInput} onChange={e => setRegistrationDeadlineInput(e.target.value)} className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition" />
                               <button onClick={handleSetRegistrationDeadline} disabled={loading} className="mt-4 w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400">Set Registration Deadline</button>
                           </div>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-lg border">
                           <h3 className="text-xl font-semibold mb-4 text-center">Set Voting Deadline</h3>
                           <div className="max-w-md mx-auto text-center">
                               <input type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition" />
                               <button onClick={handleSetDeadline} disabled={loading} className="mt-4 w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400">Set Voting Deadline</button>
                           </div>
                        </div>
                        {formMessage && <div className={`p-3 rounded-lg text-center text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                        <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                           <h3 className="text-xl font-semibold mb-2 text-center text-red-800">Danger Zone</h3>
                           <p className="text-center text-red-600 mb-4 max-w-md mx-auto">Resetting the election will delete all voters, candidates, votes, and deadlines. This action cannot be undone.</p>
                           <button onClick={handleResetElections} disabled={loading} className="w-full max-w-md mx-auto bg-red-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-800 transition-colors disabled:bg-red-400">Reset Elections</button>
                        </div>
                     </div>
                </Page>
            );
            case 'CANDIDATES': return (
                <Page title="Manage Candidates & Positions">
                    {formMessage && <div className={`p-3 rounded-lg text-center mb-6 text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        
                        {/* Left Column: Forms */}
                        <div className="xl:col-span-1 space-y-8">
                            <div className="p-6 bg-gray-50 rounded-xl border">
                                <h3 className="text-xl font-semibold mb-4">Manage Positions</h3>
                                <form onSubmit={handleAddPosition} className="flex gap-2 mb-4">
                                    <input type="text" placeholder="New Position Name" value={newPositionName} onChange={e => setNewPositionName(e.target.value)} className="w-full p-3 border rounded-lg" />
                                    <button type="submit" disabled={loading} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-800 transition disabled:bg-slate-400 flex-shrink-0">Add</button>
                                </form>
                                <div className="flex flex-wrap gap-2">
                                    {positions.map(p => {
                                        const candidateCount = candidates.filter(c => c.position === p.name).length;
                                        return (
                                            <div key={p.id} className="flex items-center bg-white py-1 pl-3 pr-1 rounded-full border text-sm font-medium text-gray-700">
                                                <span>{p.name} ({candidateCount})</span>
                                                <button onClick={() => handleDeletePosition(p.id, p.name)} className="ml-2 text-gray-400 hover:text-red-500 w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center">
                                                    <i className="fas fa-times text-xs"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                     {positions.length === 0 && <p className="text-sm text-gray-500">No positions created yet.</p>}
                                </div>
                            </div>

                            <form onSubmit={handleAddCandidate} className="p-6 bg-gray-50 rounded-xl border">
                                <h3 className="text-xl font-semibold mb-4">Add Single Candidate</h3>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Candidate Name" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full p-3 border rounded-lg" />
                                    <select value={candidatePosition} onChange={e => setCandidatePosition(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
                                        <option value="" disabled>Select a Position</option>
                                        {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <input id="candidate-photo" type="file" accept="image/*" onChange={e => setCandidatePhoto(e.target.files ? e.target.files[0] : null)} className="w-full p-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                                    <button type="submit" disabled={loading || positions.length === 0} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition disabled:bg-slate-400">Add Candidate</button>
                                </div>
                            </form>

                            <div className="p-6 bg-gray-50 rounded-xl border">
                                <h3 className="text-xl font-semibold mb-2">Add Candidates in Bulk</h3>
                                <p className="text-sm text-gray-500 mb-4">Format: <code className="bg-gray-200 px-1 rounded">CANDIDATE_NAME,POSITION_NAME</code>. One per line. Position must already exist.</p>
                                <textarea
                                    placeholder="John Doe,President&#x0a;Jane Smith,Vice President"
                                    value={bulkCandidateData}
                                    onChange={e => setBulkCandidateData(e.target.value)}
                                    className="w-full p-3 border rounded-lg h-28 font-mono text-sm"
                                    disabled={loading}
                                />
                                <button onClick={handleBulkAddCandidates} disabled={loading} className="mt-2 w-full bg-slate-600 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition disabled:bg-slate-300">Import Candidates</button>
                            </div>
                        </div>

                        {/* Right Column: Candidates List */}
                        <div className="xl:col-span-2">
                             <h3 className="text-2xl font-bold text-slate-800 mb-4">Candidate Roster</h3>
                             <div className="space-y-6 max-h-[42rem] overflow-y-auto p-1">
                                {positions.length === 0 ? <p className="text-center text-gray-500 py-10">Add a position to start adding candidates.</p> :
                                    positions.map(position => {
                                        const candidatesForPosition = candidates.filter(c => c.position === position.name);
                                        return (
                                             <div key={position.id} className="bg-white p-4 rounded-xl border shadow-sm">
                                                <h4 className="font-bold text-xl text-slate-700 border-b-2 border-slate-200 pb-2 mb-4 flex justify-between items-center">
                                                    <span>{position.name}</span>
                                                    <span className="text-base font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{candidatesForPosition.length} Candidates</span>
                                                </h4>
                                                {candidatesForPosition.length > 0 ? (
                                                    <ul className="space-y-3">
                                                        {candidatesForPosition.map((c) => (
                                                            <li key={c.id} className="flex items-center gap-4 p-2 pr-4 bg-slate-50 border rounded-lg transition-shadow hover:shadow-md">
                                                                <img src={c.photo_url} alt={c.name} className="w-16 h-16 rounded-lg object-cover"/>
                                                                <div className="flex-grow">
                                                                     <p className="font-bold text-lg text-slate-800">{c.name}</p>
                                                                     <p className="text-sm text-slate-500">{c.position}</p>
                                                                </div>
                                                                <button onClick={() => handleDeleteCandidate(c.id)} className="text-gray-400 hover:text-red-600 text-lg w-10 h-10 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors">
                                                                    <i className="fas fa-trash-alt"></i>
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-gray-500 text-center py-4">No candidates for this position yet.</p>
                                                )}
                                            </div>
                                        );
                                    })
                                 }
                             </div>
                        </div>
                    </div>
                </Page>
            );
            case 'VOTERS': {
                const physicalVotersCount = voters.filter(v => /[0-9]/.test(v.username)).length;
                const onlineVotersCount = voters.length - physicalVotersCount;

                const voterNumberMap = new Map<string, number>();
                voters
                    .slice()
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .forEach((voter, index) => {
                        voterNumberMap.set(voter.id, index + 1);
                    });

                return (
                    <Page title="Manage Voters">
                       <div className="max-w-xl mx-auto mb-8 p-6 bg-slate-100 rounded-lg border border-slate-200 text-center">
                            <i className="fas fa-info-circle text-slate-500 text-2xl mb-2"></i>
                            <h3 className="text-xl font-semibold mb-2 text-slate-800">Voter Management</h3>
                            <p className="text-slate-700">Students now register themselves by verifying their registration number. Add, edit, or remove eligible students in the <button onClick={() => setView('REGISTRATIONS')} className="font-bold text-slate-800 hover:underline">Registrations</button> tab.</p>
                       </div>
                       <h3 className="text-xl font-semibold mb-4 text-center">Registered Voters</h3>
                       
                       <div className="grid grid-cols-3 gap-4 mb-4 text-center p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <h4 className="font-semibold text-gray-600 text-sm sm:text-base">Total</h4>
                                <p className="text-2xl font-bold">{voters.length}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-600 text-sm sm:text-base">Physical</h4>
                                <p className="text-2xl font-bold">{physicalVotersCount}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-600 text-sm sm:text-base">Online</h4>
                                <p className="text-2xl font-bold">{onlineVotersCount}</p>
                            </div>
                        </div>

                       <div className="mb-4 p-4 bg-slate-50 rounded-lg border space-y-4">
                           <div className="relative">
                               <input
                                   type="text"
                                   placeholder="Search by name, username, reg number..."
                                   value={voterSearchTerm}
                                   onChange={e => setVoterSearchTerm(e.target.value)}
                                   className="w-full p-3 pl-10 border rounded-lg"
                               />
                               <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="flex items-center justify-center space-x-1 sm:space-x-2 bg-gray-200 rounded-lg p-1">
                                   <button onClick={() => setVoterStatusFilter('all')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterStatusFilter === 'all' ? 'bg-white shadow' : 'text-gray-600'}`}>All</button>
                                   <button onClick={() => setVoterStatusFilter('voted')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterStatusFilter === 'voted' ? 'bg-white shadow' : 'text-gray-600'}`}>Voted</button>
                                   <button onClick={() => setVoterStatusFilter('pending')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterStatusFilter === 'pending' ? 'bg-white shadow' : 'text-gray-600'}`}>Pending</button>
                               </div>
                               <div className="flex items-center justify-center space-x-1 sm:space-x-2 bg-gray-200 rounded-lg p-1">
                                   <button onClick={() => setVoterTypeFilter('all')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterTypeFilter === 'all' ? 'bg-white shadow' : 'text-gray-600'}`}>All Types</button>
                                   <button onClick={() => setVoterTypeFilter('physical')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterTypeFilter === 'physical' ? 'bg-white shadow' : 'text-gray-600'}`}>Physical</button>
                                   <button onClick={() => setVoterTypeFilter('online')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${voterTypeFilter === 'online' ? 'bg-white shadow' : 'text-gray-600'}`}>Online</button>
                               </div>
                           </div>
                           <div className="flex flex-wrap items-center justify-between gap-4">
                               <div className="flex items-center gap-2">
                                   <label htmlFor="sort-voters" className="text-sm font-medium text-gray-700">Sort by:</label>
                                   <select
                                       id="sort-voters"
                                       value={voterSortKey}
                                       onChange={e => setVoterSortKey(e.target.value as typeof voterSortKey)}
                                       className="p-2 border rounded-lg text-sm bg-white"
                                   >
                                       <option value="created_at">Date Added</option>
                                       <option value="username">Username</option>
                                       <option value="has_voted">Vote Status</option>
                                       <option value="voter_type">Voter Type</option>
                                   </select>
                               </div>
                               <button onClick={() => setVoterSortOrder(voterSortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 px-3 border rounded-lg text-gray-600 hover:bg-gray-100 flex items-center gap-2 text-sm">
                                   {voterSortOrder === 'asc' ? <><i className="fas fa-sort-amount-up"></i> Asc</> : <><i className="fas fa-sort-amount-down-alt"></i> Desc</>}
                               </button>
                           </div>
                       </div>
    
                       <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                            {filteredAndSortedVoters.length === 0 ? <p className="text-center text-gray-500">No voters match your criteria.</p> :
                               filteredAndSortedVoters.map((v: Voter) => {
                                    const isPhysical = /[0-9]/.test(v.username);
                                    const voterTypeLabel = isPhysical ? 'Physical' : 'Online';
                                    const labelColorClasses = 'text-slate-800 bg-slate-200';
                                    const voterNumber = voterNumberMap.get(v.id);
    
                                    return (
                                        <div key={v.id} className="flex items-start justify-between gap-4 p-4 bg-white border rounded-lg shadow-sm">
                                            <div className="flex-grow flex items-start">
                                                <span className="font-mono text-gray-500 w-8 text-right pt-0.5 pr-2 flex-shrink-0">{voterNumber}.</span>
                                                <div className="flex-grow">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-semibold">{v.username}</p>
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${labelColorClasses}`}>{voterTypeLabel}</span>
                                                    </div>
                                                    {v.full_name && <p className="text-sm text-gray-500">{v.full_name} ({v.registration_number})</p>}
                                                    {v.created_at && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><i className="far fa-clock"></i>{new Date(v.created_at).toLocaleString()}</p>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                <span className={`text-sm font-semibold px-2 py-1 rounded-full ${v.has_voted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.has_voted ? 'Voted' : 'Pending'}</span>
                                                <button onClick={() => handleDeleteVoter(v.id)} className="text-red-500 hover:text-red-700 text-xl pt-1"><i className="fas fa-trash"></i></button>
                                            </div>
                                       </div>
                                   );
                               })
                           }
                       </div>
                   </Page>
                );
            }
            case 'REGISTRATIONS': {
                const filteredRegistrations = registrations.filter(reg =>
                    reg.student_name.toLowerCase().includes(registrationSearchTerm.toLowerCase()) ||
                    reg.registration_number.toLowerCase().includes(registrationSearchTerm.toLowerCase())
                );
                return (
                    <Page title="Manage Registration Numbers">
                        <div className="max-w-xl mx-auto space-y-8">
                             <form onSubmit={handleAddOrUpdateRegistration} className="p-6 bg-gray-50 rounded-lg border">
                                <h3 className="text-xl font-semibold mb-4 text-center">{editingRegistration ? 'Edit Registration' : 'Add New Registration'}</h3>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Registration Number" value={regNumber} onChange={e => setRegNumber(e.target.value)} className="w-full p-3 border rounded-lg" />
                                    <input type="text" placeholder="Student's Full Name" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full p-3 border rounded-lg" />
                                    <div className="flex gap-2">
                                        {editingRegistration && (
                                            <button type="button" onClick={handleCancelEdit} className="w-full bg-gray-500 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition">Cancel</button>
                                        )}
                                        <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition disabled:bg-slate-400">
                                            {loading ? <i className="fas fa-spinner fa-spin"></i> : (editingRegistration ? 'Update Entry' : 'Add Entry')}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 bg-gray-50 rounded-lg border">
                                <h3 className="text-xl font-semibold mb-2 text-center">Add Registrations in Bulk</h3>
                                <p className="text-center text-sm text-gray-500 mb-4">
                                    Paste data below. Each entry on a new line.<br />
                                    Format: <code className="bg-gray-200 px-1 rounded">REGISTRATION_NUMBER,STUDENT_NAME</code>
                                </p>
                                <div className="space-y-4">
                                    <textarea
                                        placeholder={"F/HD/21/123456,John Doe\nF/HD/21/654321,Jane Smith"}
                                        value={bulkRegData}
                                        onChange={e => setBulkRegData(e.target.value)}
                                        className="w-full p-3 border rounded-lg h-40 font-mono text-sm"
                                        rows={10}
                                        disabled={loading}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleBulkAddRegistrations}
                                        disabled={loading} 
                                        className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition disabled:bg-slate-400 flex items-center justify-center gap-2">
                                        {loading ? <><i className="fas fa-spinner fa-spin"></i> Processing...</> : <><i className="fas fa-file-upload"></i> Import Bulk Data</>}
                                    </button>
                                </div>
                            </div>
                            
                            {formMessage && <div className={`p-3 rounded-lg text-center text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                        </div>
                        
                        <div className="mt-8">
                            <h3 className="text-xl font-semibold mb-4 text-center">Approved List ({filteredRegistrations.length}/{registrations.length})</h3>
                            <div className="max-w-xl mx-auto mb-4 relative">
                               <input
                                   type="text"
                                   placeholder="Search by name or registration number..."
                                   value={registrationSearchTerm}
                                   onChange={e => setRegistrationSearchTerm(e.target.value)}
                                   className="w-full p-3 pl-10 border rounded-lg"
                               />
                               <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            </div>
                            <div className="space-y-3 max-h-[32rem] overflow-y-auto p-2 max-w-xl mx-auto">
                                {registrations.length === 0 ? (
                                    <p className="text-center text-gray-500">No registration numbers added yet.</p>
                                ) : filteredRegistrations.length === 0 ? (
                                    <p className="text-center text-gray-500">No registrations found matching your search.</p>
                                ) : (
                                    filteredRegistrations.map((reg, index) => (
                                        <div key={reg.id} className="flex items-center gap-4 p-4 bg-white border rounded-lg shadow-sm">
                                            <span className="font-mono text-gray-500 w-8 text-center">{index + 1}.</span>
                                            <div className="flex-grow">
                                                <p className="font-bold text-slate-800">{reg.student_name}</p>
                                                <p className="text-gray-600 font-mono text-sm">{reg.registration_number}</p>
                                            </div>
                                           
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </Page>
                );
            }
            case 'ADMINS': return (
                 <Page title="Manage Admins">
                    <form onSubmit={handleAddAdmin} className="max-w-md mx-auto mb-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="text-xl font-semibold mb-4 text-center">Add New Admin</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="New Admin Username" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} className="w-full p-3 border rounded-lg" />
                            <PasswordField id="new-admin-password" placeholder="New Admin Password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} />
                            <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition disabled:bg-slate-400">Add Admin</button>
                        </div>
                        {formMessage && <div className={`p-3 rounded-lg text-center mt-4 text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                    </form>
                    <h3 className="text-xl font-semibold mb-4 text-center">Registered Admins</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                        {admins.map((a, index) => (
                            <div key={a.id} className="flex items-center gap-4 p-4 bg-white border rounded-lg shadow-sm">
                                <span className="font-mono text-gray-500 w-8 text-left">{index + 1}.</span>
                                <i className="fas fa-user-shield text-slate-500 text-xl"></i>
                                <p className="font-semibold flex-grow">{a.username}</p>
                            </div>
                        ))}
                    </div>
                </Page>
            );
            case 'RESULTS': return (
                <Page title="Election Results">
                    <div className="space-y-6">
                        {results.length === 0 ? <p className="text-center text-gray-500">Results are not available yet.</p> :
                            results.map(pos => (
                                <div key={pos.position} className="p-6 bg-slate-50 border rounded-xl">
                                    <h3 className="text-2xl font-bold mb-4 text-slate-700">{pos.position}</h3>
                                    <p className="text-sm text-gray-500 mb-4">Total Votes Cast: {pos.totalVotes}</p>
                                    <div className="space-y-4">
                                        {pos.candidates.map((c: any) => (
                                            <div key={c.id} className={`flex items-center gap-4 p-2 rounded-lg transition-all ${c.isTied ? 'shadow-lg shadow-slate-500/30 ring-1 ring-slate-500/20' : ''}`}>
                                                <div className={`text-2xl font-bold w-10 text-center ${c.rank === 1 ? 'text-amber-400' : 'text-gray-400'}`}>
                                                  {c.rank === 1 ? <i className="fas fa-trophy"></i> : c.rank}
                                                </div>
                                                <img src={c.photo_url} alt={c.name} className="w-14 h-14 rounded-full object-cover"/>
                                                <div className="flex-grow">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{c.name}</span>
                                                        <div className="flex items-center gap-4">
                                                           {c.isTied && <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">VOTES TIED</span>}
                                                           <span className="text-sm font-bold text-slate-800">{c.votes} votes ({c.percentage}%)</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                        <div className="bg-slate-500 h-2.5 rounded-full" style={{ width: `${c.percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    <div className="text-center mt-8">
                         <button onClick={handlePostResults} disabled={loading} className="w-full max-w-sm mx-auto bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400 flex items-center justify-center gap-2">
                            <i className="fas fa-bullhorn"></i> Post Results
                        </button>
                    </div>
                </Page>
            );
            case 'STATISTICS': {
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main column for position races */}
                            <div className="lg:col-span-2 space-y-8">
                                {results.length > 0 ? (
                                    results.map(pos => (
                                        <PositionRaceView 
                                            key={pos.position} 
                                            positionResult={pos} 
                                            updatedCandidates={updatedCandidates} 
                                        />
                                    ))
                                ) : (
                                    <div className="bg-slate-800 text-slate-400 text-center p-10 rounded-2xl border border-slate-700">
                                        <i className="fas fa-poll text-4xl mb-4"></i>
                                        <h3 className="text-xl font-bold text-white">Awaiting Results</h3>
                                        <p>Vote counts will appear here as they are tallied.</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Sidebar for overall stats and live feed */}
                            <div className="lg:col-span-1 space-y-6">
                                <StatCard 
                                    icon="fa-vote-yea" 
                                    title="Total Votes Cast" 
                                    value={dashboardStats.votes} 
                                    color="bg-slate-600"
                                    className={flashVotesCard ? 'animate-flash' : ''}
                                />
                                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                    <h3 className="text-xl font-semibold text-slate-200 mb-4 text-center">Voter Turnout</h3>
                                    <VoterTurnoutChart voted={dashboardStats.votes} total={dashboardStats.voters} />
                                </div>
                                <VoterTypeBreakdown voters={voters} />
                                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-[400px] flex flex-col">
                                    <h3 className="text-xl font-semibold mb-4 text-slate-200 flex-shrink-0 flex items-center gap-2">
                                        <i className="fas fa-wave-square text-slate-400"></i>
                                        Live Vote Feed
                                    </h3>
                                    <div className="flex-grow overflow-y-auto pr-2">
                                        <ul className="space-y-3">
                                            {recentVoters.map((voter, index) => (
                                                <li key={`${voter.registration_number}-${index}-${new Date().getTime()}`} className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-lg animate-slide-in-bottom" style={{animationDelay: `${index * 100}ms`}}>
                                                    <i className="fas fa-check-circle text-slate-300"></i>
                                                    <div className="flex-grow">
                                                        <p className="font-mono text-sm text-white font-semibold">{voter.registration_number}</p>
                                                        <p className="text-xs text-slate-400">{voter.full_name}</p>
                                                    </div>
                                                    <span className="text-xs text-slate-500 flex-shrink-0">Just now</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {recentVoters.length === 0 && (
                                            <div className="h-full flex items-center justify-center text-center text-slate-400">
                                                <i className="fas fa-satellite-dish text-3xl mb-2"></i>
                                                <p>Waiting for new online votes...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            case 'SECURITY': {
                const filteredSessions = securityData.sessionTimings
                    .filter(s => {
                        if (sessionFilter === 'voted' && !s.has_voted) return false;
                        if (sessionFilter === 'fast' && (!s.duration || s.duration > 30)) return false; // fast vote defined as <= 30s
                        return true;
                    })
                    .filter(s => 
                        s.username.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                        (s.full_name && s.full_name.toLowerCase().includes(sessionSearch.toLowerCase())) ||
                        (s.registration_number && s.registration_number.toLowerCase().includes(sessionSearch.toLowerCase()))
                    );
            
                return (
                    <Page title="Security & Anti-Fraud Center">
                        <div className="space-y-8">
                            {/* Duplicate Registrations Section */}
                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                                <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                                    <i className="fas fa-copy text-red-500"></i>Duplicate Registration Numbers
                                </h3>
                                <p className="text-slate-500 mb-6">This check identifies if a single registration number has been used to create multiple voter accounts (e.g., one for online and one for physical voting). This is a strong indicator of potential fraud.</p>
                                
                                {securityData.duplicateRegistrations.length > 0 ? (
                                    <div className="space-y-4">
                                        {securityData.duplicateRegistrations.map(({ registration_number, voters }) => (
                                            <div key={registration_number} className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
                                                <h4 className="font-bold text-red-800 font-mono text-lg">REG #: {registration_number}</h4>
                                                <p className="text-sm text-red-600 mb-3">This registration number is linked to {voters.length} different voter accounts.</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {voters.map(voter => {
                                                        const isPhysical = /[0-9]/.test(voter.username);
                                                        return (
                                                            <div key={voter.id} className="bg-white p-3 rounded shadow-sm border">
                                                                <p className="font-semibold">{voter.username}</p>
                                                                <p className="text-sm text-gray-600">{voter.full_name}</p>
                                                                <div className="flex items-center justify-between mt-2 text-xs">
                                                                    <span className={`font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-800`}>{isPhysical ? 'Physical' : 'Online'}</span>
                                                                    <span className={`font-semibold ${voter.has_voted ? 'text-green-600' : 'text-yellow-600'}`}>{voter.has_voted ? 'Voted' : 'Pending'}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-green-50 border border-green-200 rounded-lg">
                                        <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
                                        <p className="font-semibold text-green-800">No duplicate registrations found.</p>
                                    </div>
                                )}
                            </div>
            
                            {/* Session Analysis Section */}
                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                                <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                                    <i className="fas fa-hourglass-half text-slate-500"></i>Voter Session Analysis
                                </h3>
                                <p className="text-slate-500 mb-6">Review the time between a voter's registration and when they cast their vote. Extremely short durations can indicate automated or suspicious activity.</p>
                                
                                {/* Controls for the table */}
                                <div className="mb-4 p-4 bg-slate-50 rounded-lg border space-y-4">
                                   <div className="relative">
                                       <input
                                           type="text"
                                           placeholder="Search by name, username, reg number..."
                                           value={sessionSearch}
                                           onChange={e => setSessionSearch(e.target.value)}
                                           className="w-full p-3 pl-10 border rounded-lg"
                                       />
                                       <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                   </div>
                                   <div className="flex items-center justify-center space-x-1 sm:space-x-2 bg-gray-200 rounded-lg p-1">
                                       <button onClick={() => setSessionFilter('all')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${sessionFilter === 'all' ? 'bg-white shadow' : 'text-gray-600'}`}>All Sessions</button>
                                       <button onClick={() => setSessionFilter('voted')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${sessionFilter === 'voted' ? 'bg-white shadow' : 'text-gray-600'}`}>Voted Only</button>
                                       <button onClick={() => setSessionFilter('fast')} className={`px-2 sm:px-4 py-1 text-sm font-semibold rounded-md flex-1 transition ${sessionFilter === 'fast' ? 'bg-white shadow' : 'text-gray-600'}`}>Fast Votes (&lt;30s)</button>
                                   </div>
                                </div>
            
                                <div className="overflow-x-auto max-h-[40rem] overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voter</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Time</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vote Time</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredSessions.length > 0 ? filteredSessions.map(voter => {
                                                const isPhysical = /[0-9]/.test(voter.username);
                                                const isFastVote = voter.duration !== undefined && voter.duration <= 30;
                                                return (
                                                    <tr key={voter.id} className={`${isFastVote ? 'bg-red-50' : ''}`}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">{voter.full_name || voter.username}</div>
                                                            <div className="text-sm text-gray-500">{voter.registration_number || voter.username}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800`}>
                                                                {isPhysical ? 'Physical' : 'Online'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(voter.created_at).toLocaleString()}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{voter.vote_time ? new Date(voter.vote_time).toLocaleString() : <span className="text-gray-400 italic">Not Voted</span>}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            {voter.duration !== undefined ? 
                                                                <span className={isFastVote ? 'text-red-600 font-bold' : 'text-gray-900'}>
                                                                    {voter.duration}s
                                                                </span> : 
                                                                <span className="text-gray-400">-</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                );
                                            }) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No sessions match your criteria.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Page>
                );
            }
            default: return <div>Select a view</div>;
        }
    };
    
    if (!currentUser) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                    <h1 className="text-3xl font-bold text-slate-800 text-center mb-6">Election Director Login</h1>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition"
                        />
                        <PasswordField
                            id="director-password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                         {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
                        <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-4 px-4 rounded-xl hover:bg-slate-900 transition-colors disabled:bg-slate-400 flex items-center justify-center">
                           {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                           {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const NavLink: React.FC<{ icon: string; label: AdminView; currentView: AdminView; setView: (view: AdminView) => void; }> = ({ icon, label, currentView, setView }) => (
        <li>
            <a href="#" onClick={(e) => { e.preventDefault(); setView(label); setSidebarOpen(false); setFormMessage(null); }}
               className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors text-lg ${currentView === label ? 'bg-slate-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                <i className={`fas ${icon} w-6 text-center`}></i>
                <span>{label.charAt(0) + label.slice(1).toLowerCase()}</span>
            </a>
        </li>
    );

    return (
      <>
        <style>
          {`
            @keyframes flash {
                0%, 100% {
                    background-color: #1e293b; /* slate-800 */
                    border-color: #334155; /* slate-700 */
                }
                50% {
                    background-color: #1e293b; /* slate-800 */
                    border-color: #475569; /* slate-600 */

                }
            }
            .animate-flash {
                animation: flash 2s ease-in-out;
            }

            @keyframes fade-in-out {
                0% {
                    opacity: 0;
                    transform: translateY(10px);
                }
                10%, 90% {
                    opacity: 1;
                    transform: translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }
            .animate-fade-in-out {
                animation: fade-in-out 5s forwards;
            }

            @keyframes slide-in-bottom {
                0% {
                    transform: translateY(20px);
                    opacity: 0;
                }
                100% {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            .animate-slide-in-bottom {
                animation: slide-in-bottom 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
            }
            @keyframes glow {
                0%, 100% {
                    box-shadow: 0 0 5px rgba(255, 255, 255, 0), 0 0 5px rgba(255, 255, 255, 0);
                }
                50% {
                    box-shadow: 0 0 20px rgba(255, 255, 255, 0.6), 0 0 30px rgba(255, 255, 255, 0.4);
                }
            }
            .animate-glow {
                animation: glow 3s ease-in-out;
            }
            @keyframes number-bump {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.25);
                }
            }
            .animate-number-bump {
                animation: number-bump 0.5s ease-in-out;
            }
          `}
        </style>
        <div className={`min-h-screen text-slate-800 ${view === 'STATISTICS' ? 'bg-slate-900' : 'bg-slate-100'}`}>
            {/* Live Status Indicator & Toast */}
            {isLive && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-full text-sm shadow-lg border border-slate-700">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    Live
                </div>
            )}
            {newVoteToast && (
                <div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl animate-fade-in-out">
                    <i className="fas fa-vote-yea mr-2"></i> {newVoteToast}
                </div>
            )}

            {/* Mobile Header */}
            <header className="md:hidden bg-slate-800 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-20 shadow-lg">
                {view !== 'STATISTICS' ? (
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-2xl w-8 text-center">
                        <i className="fas fa-bars"></i>
                    </button>
                ) : (
                    <div className="w-8"></div> // Placeholder to keep title centered
                )}
                <div className="text-lg font-bold flex-grow text-center">{view.charAt(0) + view.slice(1).toLowerCase()}</div>
                <div className="flex items-center gap-2">
                    <i className="fas fa-user-shield"></i>
                    <span>{currentUser.username}</span>
                </div>
            </header>
            
            {/* Sidebar */}
            {view !== 'STATISTICS' && (
                <aside className={`bg-slate-800 text-white w-64 fixed top-0 left-0 h-full z-30 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                    <nav className="p-4 pt-8">
                        <h2 className="text-2xl font-bold text-center mb-8 border-b border-slate-600 pb-4">Voting Panel</h2>
                        <ul className="space-y-3">
                            <NavLink icon="fa-home" label="DASHBOARD" currentView={view} setView={setView} />
                            <NavLink icon="fa-clock" label="DEADLINE" currentView={view} setView={setView} />
                            <NavLink icon="fa-users" label="CANDIDATES" currentView={view} setView={setView} />
                            <NavLink icon="fa-user-plus" label="VOTERS" currentView={view} setView={setView} />
                            <NavLink icon="fa-id-card" label="REGISTRATIONS" currentView={view} setView={setView} />
                            <NavLink icon="fa-user-shield" label="ADMINS" currentView={view} setView={setView} />
                            <NavLink icon="fa-chart-bar" label="RESULTS" currentView={view} setView={setView} />
                            <NavLink icon="fa-chart-pie" label="STATISTICS" currentView={view} setView={setView} />
                            <NavLink icon="fa-shield-alt" label="SECURITY" currentView={view} setView={setView} />
                        </ul>
                    </nav>
                </aside>
            )}
            
            {/* Overlay for mobile */}
            {isSidebarOpen && view !== 'STATISTICS' && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}

            {/* Main Content */}
            <main className={`${view === 'STATISTICS' ? '' : 'md:ml-64'} pt-20 md:pt-8 p-4 sm:p-8 transition-all duration-300`}>
                 <h1 className={`text-4xl font-bold mb-2 ${view === 'STATISTICS' ? 'text-white' : 'text-slate-900'}`}>
                    {view === 'STATISTICS' ? 'Election Tally Center' : 'Managing Portal'}
                 </h1>
                 <p className={`${view === 'STATISTICS' ? 'text-slate-400' : 'text-slate-500'} mb-8`}>Welcome, <span className="font-semibold">{currentUser.username}</span>. Manage your election from here.</p>
                {renderView()}
            </main>
        </div>
      </>
    );
};

export default AdminPortal;
