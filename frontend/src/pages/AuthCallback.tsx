import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import API from "../services/api";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/login");
        return;
      }

      // Check if user has completed profile in our backend
      try {
        const res = await API.get(
          `/auth/check-profile?email=${session.user.email}`,
        );
        if (res.data.is_complete) {
          localStorage.setItem("token", res.data.access_token);
          localStorage.setItem("user", res.data.username);
          localStorage.setItem("full_name", res.data.full_name);
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      } catch {
        navigate("/onboarding");
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">Signing you in...</p>
    </div>
  );
};

export default AuthCallback;
