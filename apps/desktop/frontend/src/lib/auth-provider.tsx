import { createContext, useContext, useEffect, useState } from "react";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isHydrated: false });

export function useAuthContext() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  // Give useAuth hooks a chance to initialize before rendering routes.
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <AuthContext.Provider value={{ isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}
