import React, { useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Loader2 } from "lucide-react";

export default function Home() {
    const navigate = useNavigate();

    useEffect(() => {
        const redirectUser = async () => {
            try {
                const user = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
                if (user?.is_customer) {
                    navigate(createPageUrl('CustomerPortal'), { replace: true });
                } else {
                    navigate(createPageUrl('Overview'), { replace: true });
                }
            } catch (e) {
                // If not logged in, redirect to Overview by default
                navigate(createPageUrl('Overview'), { replace: true });
            }
        };
        redirectUser();
    }, [navigate]);

    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    );
}