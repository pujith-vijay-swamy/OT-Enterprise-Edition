import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface UserData {
  id: string;
  email: string;      // Consumer expects 'email'
  is_active: boolean; // Consumer expects 'is_active'
}

export const UserProfileCard: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    // Invocations matched by AST parser
    axios.get<UserData>(`/api/v1/users/${userId}`)
      .then(res => setUser(res.data))
      .catch(err => console.error("Failed to load user profile", err));
  }, [userId]);

  if (!user) return <div>Loading user profile...</div>;

  return (
    <div className="user-card">
      <h3>User Profile #{user.id}</h3>
      <p>Email: {user.email}</p>
      <p>Status: {user.is_active ? 'Active' : 'Inactive'}</p>
    </div>
  );
};
