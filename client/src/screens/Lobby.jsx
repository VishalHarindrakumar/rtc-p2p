import React,{useState,useCallback, useEffect} from 'react'
import { useSocket } from "../context/SocketProvider";


const Lobbyscreen=()=>{


    const [username,setUsername]=useState("");
    const [room,setRoom]=useState("");

    const socket = useSocket();


    const handleSubmitForm=useCallback((e)=>{
        e.preventDefault();
        console.log({username,room})
        socket.emit("room:join",{username,room});
        

    },[socket,username,room])

    const handleJoinRoom=useCallback((data)=>{
        const {email,room}=data;
        console.log(email,room)
    })

    useEffect(() => {
        socket.on("room:join", handleJoinRoom);
        return () => {
          socket.off("room:join", handleJoinRoom);
        };
      }, [socket, handleJoinRoom]);


    return(
        <div>
            <h1>Lobby</h1>
            <form onSubmit={handleSubmitForm}>
                <label htmlFor='username'>Username: </label>
                <input 
                    type="text"
                    id="username" 
                    value={username}
                    onChange={e=>{setUsername(e.target.value)}}
                    />
                <br/>
                <label htmlFor='room'>Room: </label>
                <input 
                    type="text" 
                    id="room"
                    value={room}
                    onChange={e=>{setRoom(e.target.value)}}
                />

                <br/>
                <button>Join</button>
            </form>


        </div>
    )   
}

export default Lobbyscreen