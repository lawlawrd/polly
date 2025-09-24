import React, { useEffect, useState } from "react";

const UserAvatar = ({ user }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <span
      className="user-avatar"
      title={`${user.firstName} ${user.lastName}`}
      onClick={() => console.log(user)}
    >
      {user && user.avatar && !imageError ? (
        <img
          src={user.avatar}
          alt={`${user.firstName} ${user.lastName}`}
          style={{ marginRight: "0.3em" }}
          onError={(err) => setImageError(true)}
        />
      ) : (
        <span className="no-avatar" style={{ marginRight: "0.3em" }}>
          {user.firstName && user.firstName.length > 0
            ? user.firstName.charAt(0).toUpperCase()
            : "?"}
          {user.lastName &&
          user.lastName.length > 0 &&
          user.lastName.split(" ").filter((namePart) => {
            return namePart.charAt(0) == namePart.charAt(0).toUpperCase();
          }).length > 0
            ? user.lastName
                .split(" ")
                .filter((namePart) => {
                  return namePart.charAt(0) == namePart.charAt(0).toUpperCase();
                })[0]
                .charAt(0)
            : "?"}
        </span>
      )}
    </span>
  );
};

export default UserAvatar;
