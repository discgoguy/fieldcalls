
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

console.log('🟢 Function file loaded');

Deno.serve(async (req) => {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 INITIALIZE TRIAL FUNCTION CALLED');
    console.log('Time:', new Date().toISOString());
    console.log('='.repeat(60));
    
    try {
        console.log('1️⃣ Creating base44 client from request...');
        const base44 = createClientFromRequest(req);
        console.log('✅ Client created');
        
        console.log('2️⃣ Checking authentication...');
        let user;
        try {
            user = await base44.auth.me();
            console.log('✅ User authenticated:', {
                email: user?.email,
                id: user?.id,
                subscription_status: user?.subscription_status,
                tenant_id: user?.tenant_id,
                role: user?.role
            });
        } catch (authError) {
            console.error('❌ Auth error:', authError);
            throw authError;
        }
        
        if (!user) {
            console.error('❌ No user found after auth');
            return Response.json({ 
                error: 'Unauthorized - No user found' 
            }, { status: 401 });
        }

        console.log('3️⃣ Parsing request body...');
        let body;
        try {
            body = await req.json();
            console.log('✅ Body parsed:', body);
        } catch (parseError) {
            console.error('❌ Body parse error:', parseError);
            return Response.json({ 
                error: 'Invalid request body' 
            }, { status: 400 });
        }
        
        const { company_name } = body;

        if (!company_name || !company_name.trim()) {
            console.error('❌ No company name provided');
            return Response.json({ 
                error: 'Company name is required' 
            }, { status: 400 });
        }

        console.log('4️⃣ Checking if trial already initialized...');
        if (user.subscription_status && user.subscription_status !== 'none' && user.tenant_id) {
            console.log('⚠️ User already has trial:', {
                subscription_status: user.subscription_status,
                tenant_id: user.tenant_id
            });
            return Response.json({ 
                error: 'Trial already initialized' 
            }, { status: 400 });
        }

        console.log('5️⃣ Preparing update data...');
        const today = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        const updateData = {
            company_name: company_name.trim(),
            subscription_status: 'trial',
            trial_start_date: today.toISOString().split('T')[0],
            trial_end_date: trialEnd.toISOString().split('T')[0],
            tenant_id: user.id,
            is_tenant_owner: true  // Mark as tenant owner (gives admin access to their own tenant)
        };

        console.log('📝 Update data prepared:', updateData);

        console.log('6️⃣ Updating user in database...');
        try {
            await base44.asServiceRole.entities.User.update(user.id, updateData);
            console.log('✅ User updated successfully');
        } catch (updateError) {
            console.error('❌ Update error:', updateError);
            console.error('Update error details:', {
                message: updateError.message,
                name: updateError.name,
                stack: updateError.stack
            });
            throw updateError;
        }

        console.log('7️⃣ Fetching updated user...');
        let updatedUser;
        try {
            updatedUser = await base44.asServiceRole.entities.User.get(user.id);
            console.log('✅ Updated user fetched:', {
                subscription_status: updatedUser.subscription_status,
                tenant_id: updatedUser.tenant_id,
                company_name: updatedUser.company_name,
                role: updatedUser.role
            });
        } catch (fetchError) {
            console.error('⚠️ Could not fetch updated user, but update succeeded:', fetchError);
            // Continue anyway - update was successful
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('🎉 TRIAL INITIALIZATION COMPLETE');
        console.log('='.repeat(60));
        console.log('');

        return Response.json({ 
            success: true,
            message: 'Trial initialized successfully',
            user: {
                ...user,
                ...updateData
            }
        });

    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('💥 INITIALIZE TRIAL ERROR');
        console.error('='.repeat(60));
        console.error('Error type:', typeof error);
        console.error('Error:', error);
        console.error('Error message:', error?.message);
        console.error('Error name:', error?.name);
        console.error('Error stack:', error?.stack);
        console.error('='.repeat(60));
        console.error('');
        
        return Response.json({ 
            error: error?.message || 'Failed to initialize trial',
            details: String(error)
        }, { status: 500 });
    }
});

console.log('🟢 Function setup complete');
