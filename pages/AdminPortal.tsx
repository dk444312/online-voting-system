import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';
import type { Director, Candidate, Voter, Admin, Registration } from '../types';

type AdminView = 'DASHBOARD' | 'DEADLINE' | 'CANDIDATES' | 'VOTERS' | 'REGISTRATIONS' | 'ADMINS' | 'RESULTS' | 'STATISTICS';

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
                className="w-full p-4 pr-12 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-blue-600">
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
  const COLORS = ['#10B981', '#F59E0B']; // Emerald-500, Amber-500

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={90}
          fill="#8884d8"
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value} voters`}/>
        <Legend iconType="circle" />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-gray-700">
          {total > 0 ? `${((voted / total) * 100).toFixed(1)}%` : '0%'}
        </text>
        <text x="50%" y="50%" dy={20} textAnchor="middle" className="text-sm fill-gray-500">
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
  const COLORS = ['#3B82F6', '#8B5CF6']; // Blue-500, Violet-500

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
  
  const positionCounts = candidates.reduce<Record<string, number>>((acc, candidate) => {
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
        <Bar dataKey="Candidates" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface VoteShareChartProps {
  candidate: Candidate & { votes: number };
  positionTotalVotes: number;
}
const CandidateVoteShareChart: React.FC<VoteShareChartProps> = ({ candidate, positionTotalVotes }) => {
  const data = [
    { name: candidate.name, value: candidate.votes },
    { name: 'Other Candidates', value: positionTotalVotes - candidate.votes },
  ];
  const COLORS = ['#a855f7', '#334155'];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} fill="#8884d8" paddingAngle={5} dataKey="value">
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip 
            formatter={(value: number, name: string) => [`${value} votes`, name]}
            contentStyle={{ backgroundColor: 'rgb(30 41 59 / 0.9)', borderColor: '#475569', color: '#e2e8f0', borderRadius: '0.75rem' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-white">
          {positionTotalVotes > 0 ? `${((candidate.votes / positionTotalVotes) * 100).toFixed(1)}%` : '0%'}
        </text>
        <text x="50%" y="50%" dy={25} textAnchor="middle" className="text-md fill-slate-400">
          Vote Share
        </text>
      </PieChart>
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
                    <i className="fas fa-desktop text-3xl text-cyan-400 mb-2"></i>
                    <p className="text-lg font-semibold text-slate-300">Online Voters</p>
                    <p className="text-4xl font-bold text-white">{onlineVotersCount}</p>
                    <p className="text-cyan-400 font-semibold">{onlinePercentage.toFixed(1)}%</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                    <i className="fas fa-walking text-3xl text-amber-400 mb-2"></i>
                    <p className="text-lg font-semibold text-slate-300">Physical Voters</p>
                    <p className="text-4xl font-bold text-white">{physicalVotersCount}</p>
                    <p className="text-amber-400 font-semibold">{physicalPercentage.toFixed(1)}%</p>
                </div>
            </div>
            <div className="flex w-full h-3 mt-4 rounded-full overflow-hidden bg-slate-600">
                <div style={{ width: `${onlinePercentage}%` }} className="bg-cyan-400 transition-all duration-500"></div>
                <div style={{ width: `${physicalPercentage}%` }} className="bg-amber-400 transition-all duration-500"></div>
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
    const [voters, setVoters] = useState<Voter[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [results, setResults] = useState<any[]>([]);
    
    // Form States
    const [candidateName, setCandidateName] = useState('');
    const [candidatePosition, setCandidatePosition] = useState('');
    const [candidatePhoto, setCandidatePhoto] = useState<File | null>(null);
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
    const [selectedCandidateStats, setSelectedCandidateStats] = useState<(Candidate & { votes: number, percentage: string, position: string }) | null>(null);
    const [recentVoters, setRecentVoters] = useState<{ registration_number: string; full_name: string; }[]>([]);
    const [selectedPositionStats, setSelectedPositionStats] = useState<string | null>(null);

    // Live Tracking State
    const [isLive, setIsLive] = useState(false);
    const [newVoteToast, setNewVoteToast] = useState<string | null>(null);
    const [flashVotesCard, setFlashVotesCard] = useState(false);


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

    const fetchVoters = useCallback(async () => {
        const { data } = await supabase.from('voters').select('*').order('created_at');
        setVoters(data || []);
    }, []);

    const fetchRegistrations = useCallback(async () => {
        const { data } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
        setRegistrations(data || []);
    }, []);

    const fetchAdmins = useCallback(async () => {
        const { data } = await supabase.from('directors').select('*').order('created_at');
        setAdmins(data || []);
    }, []);

    const getFinalVoteCounts = useCallback(async () => {
        const { data: candidatesData } = await supabase.from('candidates').select('*');
        if (!candidatesData) return { candidates: [], voteCounts: new Map(), totalVotes: 0 };

        const candidateIdMap = new Map<string, string>(candidatesData.map(c => [`${c.position}_${c.name}`, c.id]));
        const voteCounts = new Map<string, number>(candidatesData.map(c => [c.id, 0]));

        const { data: onlineVotes } = await supabase.from('votes').select('candidate_id');
        onlineVotes?.forEach(vote => {
            if (vote.candidate_id) {
                const candidateId = vote.candidate_id as string;
                voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
            }
        });

        const { data: physicalVotes } = await supabase.from('physical_votes').select('votes');
        physicalVotes?.forEach(pVote => {
            if (pVote.votes) {
                try {
                    const voteData: any = (typeof pVote.votes === 'string') ? JSON.parse(pVote.votes) : pVote.votes;
                    for (const position in voteData) {
                        const candidateName = voteData[position];
                        const key = `${position}_${candidateName}`;
                        const candidateId = candidateIdMap.get(key);
                        if (candidateId) {
                            voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
                        }
                    }
                } catch (e) { console.error('Error parsing physical vote data:', e); }
            }
        });

        const totalVotes = Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0);
        return { candidates: candidatesData, voteCounts, totalVotes };
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
            return {
                position,
                totalVotes: totalVotesForPosition,
                candidates: candidatesForPosition.map(c => {
                    const votes = voteCounts.get(c.id) || 0;
                    return {
                        ...c,
                        votes,
                        percentage: totalVotesForPosition > 0 ? ((votes / totalVotesForPosition) * 100).toFixed(1) : "0",
                    };
                }).sort((a,b) => b.votes - a.votes)
            };
        });
        setResults(formattedResults);
        if (formattedResults.length > 0 && formattedResults[0].candidates.length > 0) {
            const allCandidates = formattedResults.flatMap(pos => pos.candidates).sort((a, b) => b.votes - a.votes);
            if (!selectedCandidateStats) {
                setSelectedCandidateStats(allCandidates[0] || null);
            }
        }
    }, [getFinalVoteCounts, selectedCandidateStats]);
    
    const fetchRecentVoters = useCallback(async () => {
        const { data: votesData, error: votesError } = await supabase
            .from('votes')
            .select('voter_id')
            .order('created_at', { ascending: false })
            .limit(7);

        if (votesError || !votesData) {
            console.error('Error fetching recent votes:', votesError);
            return;
        }

        if (votesData.length === 0) {
            setRecentVoters([]);
            return;
        }

        const voterIds = votesData.map((v: any) => v.voter_id);

        const { data: votersData, error: votersError } = await supabase
            .from('voters')
            .select('id, registration_number, full_name')
            .in('id', voterIds);

        if (votersError || !votersData) {
            console.error('Error fetching recent voter details:', votersError);
            return;
        }

        const voterMap = new Map(votersData.map((v: any) => [v.id, { registration_number: v.registration_number, full_name: v.full_name }]));
        
        const sortedRecentVoters = votesData
            .map((vote: any) => voterMap.get(vote.voter_id))
            .filter(v => v) as { registration_number: string; full_name: string; }[];
            
        setRecentVoters(sortedRecentVoters);
    }, []);

    const loadAllData = useCallback(async () => {
        await Promise.all([fetchDashboardStats(), fetchDeadline(), fetchRegistrationDeadline(), fetchCandidates(), fetchVoters(), fetchRegistrations(), fetchAdmins(), fetchResults(), fetchRecentVoters()]);
    }, [fetchDashboardStats, fetchDeadline, fetchRegistrationDeadline, fetchCandidates, fetchVoters, fetchRegistrations, fetchAdmins, fetchResults, fetchRecentVoters]);

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
            setTimeout(() => setFlashVotesCard(false), 1000); // Duration of the flash animation
            
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
        if (view === 'STATISTICS') {
            const intervalId = setInterval(() => {
                loadAllData();
            }, 15000); // Refresh every 15 seconds

            // Cleanup function to clear the interval when the component unmounts
            // or the view changes away from STATISTICS
            return () => {
                clearInterval(intervalId);
            };
        }
    }, [view, loadAllData]);

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
            
            const { error: insertError } = await supabase.from('candidates').insert([{ name: candidateName, position: candidatePosition, photo_url: publicUrl }]);
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
                        <h3 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-3"><i className="fas fa-info-circle text-blue-500"></i>Election Status</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          <p><strong>Voting Status:</strong> <span className={`font-bold px-3 py-1 rounded-full text-sm ${electionStatus === 'Active' ? 'bg-green-100 text-green-700' : electionStatus === 'Ended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{electionStatus}</span></p>
                          <p><strong>Registration Status:</strong> <span className={`font-bold px-3 py-1 rounded-full text-sm ${isRegistrationActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isRegistrationActive ? 'Open' : 'Closed'}</span></p>
                          <p><strong>Voting Deadline:</strong> {deadline}</p>
                          <p><strong>Registration Deadline:</strong> {registrationDeadline}</p>
                          <p><strong>Time Remaining:</strong> {timeRemaining}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg text-center">
                            <i className="fas fa-users text-4xl mb-2"></i><h4 className="font-bold text-lg">Candidates</h4><p className="text-4xl font-bold">{dashboardStats.candidates}</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-500 to-rose-500 text-white p-6 rounded-xl shadow-lg text-center">
                            <i className="fas fa-user-check text-4xl mb-2"></i><h4 className="font-bold text-lg">Registered Voters</h4><p className="text-4xl font-bold">{dashboardStats.voters}</p>
                        </div>
                        <div className="bg-gradient-to-br from-cyan-400 to-sky-500 text-white p-6 rounded-xl shadow-lg text-center">
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
                               <input type="datetime-local" value={registrationDeadlineInput} onChange={e => setRegistrationDeadlineInput(e.target.value)} className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                               <button onClick={handleSetRegistrationDeadline} disabled={loading} className="mt-4 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">Set Registration Deadline</button>
                           </div>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-lg border">
                           <h3 className="text-xl font-semibold mb-4 text-center">Set Voting Deadline</h3>
                           <div className="max-w-md mx-auto text-center">
                               <input type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                               <button onClick={handleSetDeadline} disabled={loading} className="mt-4 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">Set Voting Deadline</button>
                           </div>
                        </div>
                        {formMessage && <div className={`p-3 rounded-lg text-center text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                        <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                           <h3 className="text-xl font-semibold mb-2 text-center text-red-800">Danger Zone</h3>
                           <p className="text-center text-red-600 mb-4 max-w-md mx-auto">Resetting the election will delete all voters, candidates, votes, and deadlines. This action cannot be undone.</p>
                           <button onClick={handleResetElections} disabled={loading} className="w-full max-w-md mx-auto bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-300">Reset Elections</button>
                        </div>
                     </div>
                </Page>
            );
            case 'CANDIDATES': return (
                <Page title="Manage Candidates">
                    <form onSubmit={handleAddCandidate} className="max-w-md mx-auto mb-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="text-xl font-semibold mb-4 text-center">Add Candidate</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Candidate Name" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full p-3 border rounded-lg" />
                            <input type="text" placeholder="Position" value={candidatePosition} onChange={e => setCandidatePosition(e.target.value)} className="w-full p-3 border rounded-lg" />
                            <input id="candidate-photo" type="file" accept="image/*" onChange={e => setCandidatePhoto(e.target.files ? e.target.files[0] : null)} className="w-full p-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300">Add Candidate</button>
                        </div>
                        {formMessage && <div className={`p-3 rounded-lg text-center mt-4 text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                    </form>
                    <h3 className="text-xl font-semibold mb-4 text-center">Candidates List</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                        {candidates.length === 0 ? <p className="text-center text-gray-500">No candidates added yet.</p> :
                            candidates.map((c, index) => (
                                <div key={c.id} className="flex items-center gap-4 p-4 bg-white border rounded-lg shadow-sm">
                                    <span className="font-mono text-gray-500 w-8 text-center text-lg">{index + 1}.</span>
                                    <img src={c.photo_url} alt={c.name} className="w-16 h-16 rounded-full object-cover"/>
                                    <div className="flex-grow">
                                        <p className="font-bold text-lg">{c.name}</p>
                                        <p className="text-gray-600">{c.position}</p>
                                    </div>
                                    <button onClick={() => handleDeleteCandidate(c.id)} className="text-red-500 hover:text-red-700 text-xl"><i className="fas fa-trash"></i></button>
                                </div>
                            ))
                        }
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
                       <div className="max-w-xl mx-auto mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200 text-center">
                            <i className="fas fa-info-circle text-blue-500 text-2xl mb-2"></i>
                            <h3 className="text-xl font-semibold mb-2 text-blue-800">Voter Management</h3>
                            <p className="text-blue-700">Students now register themselves by verifying their registration number. Add, edit, or remove eligible students in the <button onClick={() => setView('REGISTRATIONS')} className="font-bold text-blue-800 hover:underline">Registrations</button> tab.</p>
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
                                    const labelColorClasses = isPhysical ? 'text-purple-800 bg-purple-100' : 'text-blue-800 bg-blue-100';
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
                                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300">
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
                                        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:bg-green-300 flex items-center justify-center gap-2">
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
                                            <div className="flex gap-3">
                                                <button onClick={() => handleEditRegistration(reg)} className="text-blue-500 hover:text-blue-700 text-lg"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => handleDeleteRegistration(reg.id)} className="text-red-500 hover:text-red-700 text-lg"><i className="fas fa-trash"></i></button>
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
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300">Add Admin</button>
                        </div>
                        {formMessage && <div className={`p-3 rounded-lg text-center mt-4 text-sm ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formMessage.text}</div>}
                    </form>
                    <h3 className="text-xl font-semibold mb-4 text-center">Registered Admins</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                        {admins.map((a, index) => (
                            <div key={a.id} className="flex items-center gap-4 p-4 bg-white border rounded-lg shadow-sm">
                                <span className="font-mono text-gray-500 w-8 text-left">{index + 1}.</span>
                                <i className="fas fa-user-shield text-blue-500 text-xl"></i>
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
                                        {pos.candidates.map((c: any, index: number) => (
                                            <div key={c.id} className="flex items-center gap-4">
                                                <div className={`text-2xl font-bold w-10 text-center ${index === 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                                                  {index === 0 ? <i className="fas fa-trophy"></i> : index + 1}
                                                </div>
                                                <img src={c.photo_url} alt={c.name} className="w-14 h-14 rounded-full object-cover"/>
                                                <div className="flex-grow">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{c.name}</span>
                                                        <span className="text-sm font-bold text-blue-600">{c.votes} votes ({c.percentage}%)</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${c.percentage}%` }}></div>
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
                         <button onClick={handlePostResults} disabled={loading} className="w-full max-w-sm mx-auto bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-300 flex items-center justify-center gap-2">
                            <i className="fas fa-bullhorn"></i> Post Results
                        </button>
                    </div>
                </Page>
            );
            case 'STATISTICS': {
                const allCandidatesWithVotes = results.flatMap(pos => pos.candidates.map((c: any) => ({...c, position: pos.position}))).sort((a,b) => b.votes - a.votes);
                
                const handleSelectCandidate = (candidate: any) => {
                    setSelectedCandidateStats(candidate);
                };
                const currentPosition = results.find(pos => pos.position === selectedCandidateStats?.position);
                
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Top Row: Overall Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard icon="fa-users" title="Candidates" value={dashboardStats.candidates} color="bg-purple-500" />
                            <StatCard icon="fa-user-check" title="Registered Voters" value={dashboardStats.voters} color="bg-sky-500" />
                            <StatCard 
                                icon="fa-vote-yea" 
                                title="Votes Cast" 
                                value={dashboardStats.votes} 
                                color="bg-emerald-500"
                                className={flashVotesCard ? 'animate-flash' : ''}
                            />
                            <StatCard 
                                icon="fa-chart-pie" 
                                title="Voter Turnout" 
                                value={`${dashboardStats.voters > 0 ? ((dashboardStats.votes / dashboardStats.voters) * 100).toFixed(1) : '0'}%`} 
                                color="bg-amber-500" 
                            />
                        </div>

                        {/* Middle Row: Main Chart & Voter DNA */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 h-[400px] flex flex-col">
                                <h3 className="text-xl font-semibold mb-4 text-slate-200 flex-shrink-0">Live Vote Feed</h3>
                                <div className="flex-grow overflow-hidden relative">
                                    <ul className="space-y-3">
                                        {recentVoters.map((voter, index) => (
                                            <li key={`${voter.registration_number}-${index}`} className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-lg animate-slide-in-bottom">
                                                <i className="fas fa-check-circle text-emerald-400"></i>
                                                <div className="flex-grow">
                                                    <p className="font-mono text-white font-semibold">{voter.registration_number}</p>
                                                    <p className="text-sm text-slate-400">{voter.full_name}</p>
                                                </div>
                                                <span className="text-xs text-slate-500">Just now</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {recentVoters.length === 0 && (
                                        <div className="h-full flex items-center justify-center text-center text-slate-400">
                                            <p>Waiting for new online votes...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <VoterTypeBreakdown voters={voters} />
                        </div>

                        {/* Bottom Row: Candidate Performance & Position Breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Candidate Leaderboard & Chart */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                    <h3 className="text-xl font-semibold mb-4 text-slate-200">Candidate Performance</h3>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                        {allCandidatesWithVotes.length > 0 ? allCandidatesWithVotes.map((c, index) => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => handleSelectCandidate(c)}
                                                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${selectedCandidateStats?.id === c.id ? 'bg-slate-600/50' : 'hover:bg-slate-700/50'}`}
                                            >
                                                <span className="font-mono text-slate-400 w-6 text-center">{index + 1}</span>
                                                <img src={c.photo_url} alt={c.name} className="w-10 h-10 rounded-full object-cover"/>
                                                <div className="flex-grow">
                                                    <p className="font-semibold text-white">{c.name}</p>
                                                    <p className="text-sm text-slate-400">{c.position}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-lg text-white">{c.votes}</p>
                                                    <p className="text-xs text-purple-400">{c.percentage}%</p>
                                                </div>
                                            </div>
                                        )) : <p className="text-slate-400 text-center py-8">No candidates to display.</p>}
                                    </div>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
                                    {selectedCandidateStats && currentPosition ? (
                                        <>
                                            <h4 className="text-xl font-semibold text-center text-slate-200 mb-2">{selectedCandidateStats.name}</h4>
                                            <div className="w-full flex-grow">
                                               <CandidateVoteShareChart candidate={selectedCandidateStats} positionTotalVotes={currentPosition.totalVotes} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <i className="fas fa-mouse-pointer text-4xl mb-4"></i>
                                            <p>Select a candidate to view their vote share details.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Position Breakdown */}
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <h3 className="text-xl font-semibold mb-4 text-slate-200">Position Breakdown</h3>
                                <select onChange={e => setSelectedPositionStats(e.target.value)} defaultValue="" className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4">
                                    <option value="" disabled>Select a position</option>
                                    {results.map(pos => <option key={pos.position} value={pos.position}>{pos.position}</option>)}
                                </select>
                                {selectedPositionStats ? (() => {
                                    const positionData = results.find(p => p.position === selectedPositionStats);
                                    if (!positionData) return <p className="text-center text-slate-400 mt-4">Position data not found.</p>;

                                    const chartData = positionData.candidates.map((c: any) => ({ name: c.name, votes: c.votes })).sort((a: any, b: any) => a.votes - b.votes);

                                    return (
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={chartData}
                                                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                                                    layout="vertical"
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255, 255, 255, 0.1)" />
                                                    <XAxis type="number" allowDecimals={false} stroke="#94a3b8" />
                                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} interval={0} tick={{ fontSize: 12 }} />
                                                    <Tooltip 
                                                        cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }} 
                                                        contentStyle={{ backgroundColor: 'rgb(30 41 59 / 0.9)', borderColor: '#475569', color: '#e2e8f0', borderRadius: '0.75rem' }}
                                                    />
                                                    <Bar dataKey="votes" fill="#a855f7" name="Total Votes" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    );
                                })() : <p className="text-center text-slate-400 mt-4">Select a position to see vote distribution.</p>}
                            </div>
                        </div>
                    </div>
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
                            className="w-full p-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <PasswordField
                            id="director-password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                         {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center">
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
               className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors text-lg ${currentView === label ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
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
                }
                50% {
                    background-color: #5b21b6; /* purple-700 for a noticeable flash */
                }
            }
            .animate-flash {
                animation: flash 1s ease-in-out;
            }

            @keyframes fade-in-out {
                0% {
                    opacity: 0;
                    transform: translateY(20px);
                }
                10% {
                    opacity: 1;
                    transform: translateY(0);
                }
                90% {
                    opacity: 1;
                    transform: translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: translateY(20px);
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
                <div className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-xl animate-fade-in-out">
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
