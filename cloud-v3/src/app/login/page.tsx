import Form from 'next/form';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function LoginPage() {
    async function handleLogin(formData: FormData) {
        'use server';

        const cookieStore = await cookies();
        cookieStore.set('token', '1234567890');

        redirect('/');
    }

    return (
        <div>
            <h1>Login</h1>
            <Form action={handleLogin}>
                <input type="text" name="username" />
                <input type="password" name="password" />
                <button type="submit">Login</button>
            </Form>
        </div>
    )
}
