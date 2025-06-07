import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    email: null,
    forgotPassword: false,
  },
  reducers: {
    setEmail: (state, action) => {
      state.email = action.payload.email;
      state.forgotPassword = action.payload.forgotPassword || false;
    },
    clearEmail: (state) => {
      state.email = null;
      state.forgotPassword = false;
    },
  },
});

export const { setEmail, clearEmail } = authSlice.actions;
export default authSlice.reducer;