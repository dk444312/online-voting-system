
export interface Director {
  id: string;
  username: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  photo_url: string;
  created_at: string;
}

export interface Voter {
  id: string;
  username: string;
  has_voted: boolean;
  registration_number?: string;
  full_name?: string;
  program?: string;
  year?: string;
  created_at: string;
}

export interface Admin {
    id: string;
    username: string;
    created_at: string;
}
