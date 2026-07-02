import { useAuth } from "../context/AuthContext";

export default function PendingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="text-xl font-semibold text-blue-900">
            Account Pending Approval
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Your account has been created and is awaiting approval from the
            system administrator. You will be able to access the system once
            your account has been approved.
          </p>
        </div>
        <div className="border-t pt-6">
          <p className="text-xs text-gray-400 mb-4">
            If you believe this is a mistake, please contact your campus
            administrator.
          </p>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
